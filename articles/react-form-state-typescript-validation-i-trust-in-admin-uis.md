---
title: "React form state and TypeScript validation I trust in admin UIs"
slug: react-form-state-typescript-validation-i-trust-in-admin-uis
date: 2026-10-09
category: Engineering
excerpt: "Admin forms are where React apps quietly rot. Here is how I shape form state, schema validation, server errors, and dirty tracking with TypeScript so settings screens stay honest as they grow."
readTime: 12 min
tags: [react, typescript, forms, validation, zod, react-hook-form, admin-ui, frontend, testing]
---

# React form state and TypeScript validation I trust in admin UIs

Every admin product I have worked on eventually has one screen nobody wants to touch. It is almost never the dashboard. It is the settings form. Forty fields, three tabs, conditional sections, a save button that sometimes works, and a `useState` per input that someone added in a hurry two years ago.

I have built a lot of these screens, for plugins, for SaaS back offices, and for internal tools. The pattern that hurts is always the same: the form starts small, state lives in a dozen hooks, validation lives in the submit handler, and server errors get shown in a toast that disappears before anyone reads it. Then a new field arrives and the whole thing gets more fragile.

This article is how I build admin forms in React today so they survive growth. It is opinionated. It is not the only way. But it is the way that has caused me the fewest late-night bug reports.

## The problem is not React, it is ownership

Before talking about libraries, I want to name what actually goes wrong. In a broken form, nobody owns these questions:

- What is the shape of the data, and who decides it?
- What counts as valid, and is that rule the same on client and server?
- What is the difference between "the user typed something" and "the value changed from what we loaded"?
- Where does a server-side error for a specific field end up?
- What happens when the user navigates away with unsaved changes?

If each of those has a single answer in code, the form stays maintainable. If each answer is scattered across components, no library will save you.

## One schema as the source of truth

I start every non-trivial form with a schema. Today I usually reach for Zod because it gives me runtime validation and a TypeScript type from one declaration. Valibot or Yup work too. The point is a single definition.

```ts
import { z } from 'zod';

export const storeSettingsSchema = z
  .object({
    storeName: z.string().trim().min(2, 'Store name is too short').max(80),
    supportEmail: z.string().email('Enter a valid email'),
    currency: z.enum(['USD', 'EUR', 'BDT']),
    taxEnabled: z.boolean(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    webhookUrl: z.string().url().optional().or(z.literal('')),
  })
  .superRefine((value, ctx) => {
    if (value.taxEnabled && value.taxRate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taxRate'],
        message: 'Tax rate is required when tax is enabled',
      });
    }
  });

export type StoreSettings = z.infer<typeof storeSettingsSchema>;
```

A few things I care about here:

1. **Cross-field rules live in the schema**, not in a submit handler. The "tax rate required when tax is enabled" rule is data logic, so it sits with the data.
2. **`coerce` for numbers** because HTML inputs give you strings. I would rather coerce once in the schema than call `Number()` in five places.
3. **Empty string is an explicit allowed value** for optional URLs. Admin users clear fields. If you do not model that, you get "Invalid URL" on an empty input and a confused support ticket.

The type `StoreSettings` now flows everywhere: the API client, the form, the tests. When a backend engineer adds a field, the compiler tells me which components need to care.

## Keep form state out of a pile of useState

For small forms, `useState` is fine. Once a form has more than five or six fields, conditional sections, or dirty tracking, I use React Hook Form. Not because it is trendy, but because it keeps inputs uncontrolled by default, which means typing in one field does not re-render the whole screen.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function StoreSettingsForm({ initial }: { initial: StoreSettings }) {
  const form = useForm<StoreSettings>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: initial,
    mode: 'onBlur',
  });

  const { register, handleSubmit, formState, watch } = form;
  const taxEnabled = watch('taxEnabled');

  return (
    <form onSubmit={handleSubmit(onSave)} noValidate>
      <Field label="Store name" error={formState.errors.storeName?.message}>
        <input {...register('storeName')} />
      </Field>

      <Field label="Support email" error={formState.errors.supportEmail?.message}>
        <input type="email" {...register('supportEmail')} />
      </Field>

      <label>
        <input type="checkbox" {...register('taxEnabled')} /> Enable tax
      </label>

      {taxEnabled && (
        <Field label="Tax rate (%)" error={formState.errors.taxRate?.message}>
          <input inputMode="decimal" {...register('taxRate')} />
        </Field>
      )}

      <SaveBar dirty={formState.isDirty} submitting={formState.isSubmitting} />
    </form>
  );
}
```

### Why `mode: 'onBlur'`

Validating on every keystroke in an admin form is noisy. The user types two characters of an email and gets a red error. Validating only on submit is the opposite problem: they fill twenty fields and get eight errors at once. `onBlur` is the middle ground I use by default, then React Hook Form re-validates on change once a field has an error, so the message clears as soon as it is fixed.

### `noValidate` on the form

I turn off browser validation so there is one validation system, not two that disagree on what an email is.

## Default values are a contract with the server

The most common bug I see in edit forms is defaults that do not match what the server returned. The API sends `null` for an empty webhook, the schema expects a string, and now the form is dirty the moment it loads.

I fix this with a small mapping layer between API and form:

```ts
type StoreSettingsDto = {
  store_name: string;
  support_email: string;
  currency: 'USD' | 'EUR' | 'BDT';
  tax_enabled: boolean;
  tax_rate: number | null;
  webhook_url: string | null;
};

export function toFormValues(dto: StoreSettingsDto): StoreSettings {
  return {
    storeName: dto.store_name,
    supportEmail: dto.support_email,
    currency: dto.currency,
    taxEnabled: dto.tax_enabled,
    taxRate: dto.tax_rate ?? undefined,
    webhookUrl: dto.webhook_url ?? '',
  };
}

export function toPayload(values: StoreSettings): Partial<StoreSettingsDto> {
  return {
    store_name: values.storeName,
    support_email: values.supportEmail,
    currency: values.currency,
    tax_enabled: values.taxEnabled,
    tax_rate: values.taxEnabled ? values.taxRate ?? null : null,
    webhook_url: values.webhookUrl || null,
  };
}
```

This looks like boilerplate. It is the cheapest insurance in the whole form. It keeps snake_case out of components, normalizes `null` versus empty string in one place, and gives me two pure functions I can unit test without rendering anything.

When the data loads after the form mounts, I call `form.reset(toFormValues(dto))` instead of passing new `defaultValues`. `reset` updates the baseline that dirty tracking compares against, which is exactly what you want after a fetch or after a successful save.

## Server errors belong next to fields

Client validation is a convenience. The server is the authority. A unique store name, a webhook URL that fails a reachability check, a permission rule: these can only be known server-side. Laravel and most frameworks return field-level errors as a map, so I map them back into the form.

```ts
type ApiValidationError = {
  message: string;
  errors: Record<string, string[]>;
};

const fieldMap: Record<string, keyof StoreSettings> = {
  store_name: 'storeName',
  support_email: 'supportEmail',
  tax_rate: 'taxRate',
  webhook_url: 'webhookUrl',
};

async function onSave(values: StoreSettings) {
  try {
    const saved = await api.updateStoreSettings(toPayload(values));
    form.reset(toFormValues(saved));
    notify.success('Settings saved');
  } catch (error) {
    if (isValidationError(error)) {
      for (const [key, messages] of Object.entries(error.errors)) {
        const field = fieldMap[key];
        if (field) {
          form.setError(field, { type: 'server', message: messages[0] });
        } else {
          form.setError('root.server', { type: 'server', message: messages[0] });
        }
      }
      return;
    }
    form.setError('root.server', { type: 'server', message: 'Could not save. Try again.' });
  }
}
```

Two rules I hold to:

- **Unknown server errors still surface.** If the backend returns an error key I did not map, it goes to a form-level banner, not into the void.
- **Reset after save with the server response**, not with the submitted values. The server may normalize things, trim strings, or fill defaults. The form should show what is actually stored.

## Dirty tracking and unsaved changes

Admin users switch tabs, click sidebar links, and close the browser mid-edit. Losing a long form is the kind of thing that makes people distrust a product.

```tsx
function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}
```

For in-app navigation, I hook into the router's blocking API when it has one. The important part is that `isDirty` is trustworthy, and that only happens if default values were mapped correctly and `reset` is called after saves. A dirty flag that is always true trains users to ignore the warning.

I also show a sticky save bar only when the form is dirty. It is a small UX detail that tells the user "you have changes" without a modal.

## Splitting big forms without splitting state

The forty-field settings screen usually ends up with tabs. The mistake is giving each tab its own form, then trying to merge them on save. Now you have three dirty flags, three validation passes, and a save button that only saves the tab you are on.

I keep one form and use `FormProvider` so sections can read it:

```tsx
import { FormProvider, useFormContext } from 'react-hook-form';

function TaxSection() {
  const { register, formState } = useFormContext<StoreSettings>();
  return (
    <Field label="Tax rate (%)" error={formState.errors.taxRate?.message}>
      <input {...register('taxRate')} />
    </Field>
  );
}

<FormProvider {...form}>
  <Tabs>
    <Tab title="General"><GeneralSection /></Tab>
    <Tab title="Tax" hasError={!!form.formState.errors.taxRate}><TaxSection /></Tab>
  </Tabs>
</FormProvider>
```

The `hasError` badge on tabs matters more than it looks. If validation fails on a hidden tab and nothing tells the user, they press save, nothing happens, and they assume the product is broken.

If tabs truly save independently, for example "Billing" hits a different endpoint with different permissions, then they are separate forms and should look separate. Pretending otherwise is where the bugs come from.

## Field arrays without index bugs

Repeatable rows, like shipping zones, webhook endpoints, or custom fields, are where I have seen the strangest bugs. Using the array index as a React key means deleting row two makes row three inherit row two's input state.

```tsx
const { fields, append, remove } = useFieldArray({
  control: form.control,
  name: 'endpoints',
});

{fields.map((field, index) => (
  <div key={field.id}>
    <input {...register(`endpoints.${index}.url` as const)} />
    <button type="button" onClick={() => remove(index)}>Remove</button>
  </div>
))}
```

`field.id` is a stable generated id. Use it. Also mark the remove button `type="button"` or it will submit the form, which is a bug I have shipped exactly once and never again.

## A small Field component pays for itself

Every form I own has a tiny `Field` wrapper. It handles the label, the error message, and accessibility wiring:

```tsx
function Field({ label, error, children }: {
  label: string;
  error?: string;
  children: React.ReactElement;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })}
      {error && <p id={errorId} role="alert">{error}</p>}
    </div>
  );
}
```

This means screen readers announce errors, labels are clickable, and nobody on the team forgets `htmlFor` again. It is also the single place to change error styling when design asks.

## Async options and dependent fields

Admin forms often have selects whose options come from the server: countries then states, categories, user lists. I keep that data in the data-fetching layer (TanStack Query in most of my projects), not in form state. The form stores the selected id. The query stores the options.

When a parent field changes, I clear the child explicitly:

```ts
const country = watch('country');
useEffect(() => {
  form.setValue('state', '', { shouldDirty: true, shouldValidate: false });
}, [country]);
```

Being explicit here prevents the classic bug where a user changes country and saves a state that belongs to the old country.

## Testing forms the way users use them

I do not unit test React Hook Form. I test behaviour with Testing Library:

```tsx
test('requires tax rate when tax is enabled', async () => {
  const user = userEvent.setup();
  render(<StoreSettingsForm initial={baseSettings} />);

  await user.click(screen.getByLabelText(/enable tax/i));
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/tax rate is required/i)).toBeInTheDocument();
});

test('shows server error next to the field', async () => {
  server.use(mockValidationError({ store_name: ['Name already taken'] }));
  const user = userEvent.setup();
  render(<StoreSettingsForm initial={baseSettings} />);

  await user.clear(screen.getByLabelText(/store name/i));
  await user.type(screen.getByLabelText(/store name/i), 'Taken Store');
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(await screen.findByText(/name already taken/i)).toBeInTheDocument();
});
```

Plus plain unit tests for `toFormValues`, `toPayload`, and the schema itself. Those three are where most real bugs live, and they run in milliseconds.

## Things I avoid

- **Mirroring every input into global state.** Redux or Zustand for draft form values is almost never needed. The form library already holds them.
- **`useEffect` to sync props into state.** Use `reset` when the server data changes.
- **Validation in the submit handler.** It always drifts from what the UI shows.
- **Toast-only errors.** Toasts are for success and generic failures, not "this field is wrong".
- **Disabling the save button when invalid.** Users cannot see why. Let them press it and show the errors.

## A checklist before I call a form done

1. One schema defines shape and rules, and the TypeScript type comes from it.
2. API and form values are mapped by pure, tested functions.
3. Defaults do not make the form dirty on load.
4. Server field errors appear next to the field; unknown ones appear in a banner.
5. The form resets to the server response after save.
6. Unsaved changes are guarded.
7. Hidden tabs show error badges.
8. Field arrays use stable keys.
9. Every input has a label and accessible error wiring.
10. Behaviour tests cover the conditional rules and server errors.

## Ending note

Forms are not glamorous, but they are where users spend real time in admin products, and where trust gets won or lost. The libraries matter less than the ownership: one schema, one mapping layer, one place for errors, and a dirty flag you can believe. Get those right and the forty-field settings screen stops being the place nobody wants to touch. It becomes just another file.
