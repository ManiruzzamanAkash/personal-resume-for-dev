---
title: "WordPress plugin dependency injection: stop new-ing everything in plugins_loaded"
slug: wordpress-plugin-dependency-injection-service-containers
date: 2026-09-14
category: Engineering
excerpt: "Most WordPress plugins are a tangle of singletons and global functions. Here is how I introduce a small service container so features stay testable, swappable, and honest about their dependencies."
readTime: 11 min
tags: [wordpress, php, architecture, dependency-injection, woocommerce, plugins]
---

# WordPress plugin dependency injection: stop new-ing everything in plugins_loaded

I can usually tell how a WordPress plugin will age by reading the first fifty lines after `plugins_loaded`.

If every class is constructed inline — logger, HTTP client, settings repository, checkout hook — and those constructors reach into globals, options, and other classes that also construct their own friends, the plugin will fight you the first time you need a second payment provider, a staging override, or a unit test that does not boot half of WooCommerce.

Dependency injection is not a framework fashion. It is a discipline for saying out loud what a class needs, and for keeping construction in one place so the rest of the code can stay boring. WordPress does not ship a container. That does not mean your plugin should invent a new singleton every week.

I ship WordPress and WooCommerce plugins for shops and product teams. The architecture that survives releases is almost never “more OOP.” It is fewer hidden dependencies and a clear boot sequence.

## What “DI” actually means in a plugin

Skip the academic definition. In practice I care about three rules:

1. **A class does not create its collaborators.** It receives them.
2. **Construction happens once**, early, in a composition root — not scattered across hooks.
3. **Interfaces (or narrow contracts) sit at boundaries** you expect to swap: HTTP, storage, clock, mailer, gateway client.

That is it. You do not need Laravel. You do not need a 400-line container. You need honesty about dependencies and a single place that wires them.

The opposite pattern is familiar:

```php
class OrderExporter {
    public function export( $order_id ) {
        $logger  = new FileLogger( WP_CONTENT_DIR . '/uploads/export.log' );
        $client  = new RemoteApiClient( get_option( 'my_plugin_api_key' ) );
        $mapper  = new OrderMapper( new WC_Order( $order_id ) );
        // ...
    }
}
```

Every call builds a fresh stack. Tests cannot substitute the client. Staging cannot point at a sandbox host without editing the class. Two exporters fighting over the same log file become a support ticket.

Injected version:

```php
class OrderExporter {
    public function __construct(
        private OrderRepository $orders,
        private RemoteApiClient $client,
        private Logger $logger
    ) {}

    public function export( int $order_id ): void {
        $payload = $this->orders->to_export_payload( $order_id );
        $this->client->send( $payload );
        $this->logger->info( 'export.ok', [ 'order_id' => $order_id ] );
    }
}
```

Now the class is about exporting. Wiring lives elsewhere.

## Why WordPress plugins fight this pattern

WordPress encourages procedural bootstraps. Hooks fire in an order you do not fully control. Plugins load before themes. WooCommerce may or may not be active. Multisite changes when options resolve. Many senior WP developers learned to “just get the hook working” — and that skill is real — but it trains you to hide dependencies inside the hook callback.

Common anti-patterns I still see in production codebases:

- **God `Plugin` singleton** that owns settings, assets, REST, and cron
- **`get_instance()` chains** that look like DI but are global state with nicer names
- **Static helpers** that read `$_POST` and options from anywhere
- **Constructing `WC_Order` / `WP_User` deep inside domain services** instead of behind a repository
- **Bootstrapping on `init` and again on `admin_init`** with divergent object graphs

None of these are immoral. They become expensive when the feature set grows past “one settings page and a shortcode.”

## A small container is enough

I usually start with a tiny array-backed container — not a full PSR-11 implementation unless the team already standardizes on one.

```php
final class Container {
    /** @var array<string, callable(self): object> */
    private array $factories = [];

    /** @var array<string, object> */
    private array $services = [];

    public function set( string $id, callable $factory ): void {
        $this->factories[ $id ] = $factory;
    }

    public function get( string $id ): object {
        if ( isset( $this->services[ $id ] ) ) {
            return $this->services[ $id ];
        }

        if ( ! isset( $this->factories[ $id ] ) ) {
            throw new RuntimeException( "Unknown service: {$id}" );
        }

        return $this->services[ $id ] = ( $this->factories[ $id ] )( $this );
    }
}
```

Register factories once:

```php
$container = new Container();

$container->set( Settings::class, fn () => Settings::from_options() );

$container->set( Logger::class, function ( Container $c ) {
    return new Logger(
        $c->get( Settings::class )->log_level(),
        WP_CONTENT_DIR . '/uploads/my-plugin.log'
    );
});

$container->set( RemoteApiClient::class, function ( Container $c ) {
    $settings = $c->get( Settings::class );
    return new RemoteApiClient(
        $settings->api_base_url(),
        $settings->api_key()
    );
});

$container->set( OrderExporter::class, function ( Container $c ) {
    return new OrderExporter(
        $c->get( OrderRepository::class ),
        $c->get( RemoteApiClient::class ),
        $c->get( Logger::class )
    );
});
```

Then the plugin bootstrap resolves only the entry points that need hooks:

```php
add_action( 'plugins_loaded', function () use ( $container ) {
    if ( ! class_exists( 'WooCommerce' ) ) {
        return;
    }

    $container->get( CheckoutHooks::class )->register();
    $container->get( AdminPages::class )->register();
    $container->get( RestController::class )->register();
});
```

Hooks register. They do not construct the world.

## Composition root, not “service locator everywhere”

A container used as a global bag you `get()` from deep inside domain code is just a dressed-up singleton. I treat the container as **construction-time** infrastructure.

Allowed:

- Plugin bootstrap / `plugins_loaded` callback
- CLI command entry
- REST controller factory when WordPress instantiates the controller

Discouraged:

- `$container->get( Foo::class )` inside a mapper, a validator, or a WooCommerce filter callback that already received collaborators

If a hook callback needs five services, inject them into a small `CheckoutHooks` class whose `register()` method closes over `$this`:

```php
final class CheckoutHooks {
    public function __construct(
        private OrderExporter $exporter,
        private FraudChecker $fraud
    ) {}

    public function register(): void {
        add_action( 'woocommerce_checkout_order_processed', [ $this, 'on_order' ], 20, 1 );
    }

    public function on_order( int $order_id ): void {
        if ( $this->fraud->should_hold( $order_id ) ) {
            return;
        }
        $this->exporter->export( $order_id );
    }
}
```

The WordPress hook API stays procedural. Your domain stays injectable.

## Interfaces at the edges you will swap

I do not interface every class. I interface the seams that change between environments or vendors:

- **Clock** — tests freeze time; production uses `time()` / `DateTimeImmutable`
- **HTTP client** — swap Guzzle, WordPress `wp_remote_*`, or a fake
- **Secret store** — options vs environment vs a vault wrapper
- **Gateway / ERP client** — sandbox vs live, or Paysera-style provider adapters
- **Mailer / notifier** — `wp_mail` vs queue vs no-op in tests

Example clock:

```php
interface Clock {
    public function now(): DateTimeImmutable;
}

final class SystemClock implements Clock {
    public function now(): DateTimeImmutable {
        return new DateTimeImmutable( 'now', new DateTimeZone( 'UTC' ) );
    }
}

final class FrozenClock implements Clock {
    public function __construct( private DateTimeImmutable $now ) {}
    public function now(): DateTimeImmutable {
        return $this->now;
    }
}
```

Payment work taught me this the hard way. At Paysera the interesting failures were rarely “wrong class design.” They were “staging still pointed at live credentials” and “the HTTP client retry policy lived in three plugins differently.” A shared client interface with one retry policy beat three clever singletons.

## WooCommerce-specific wiring notes

WooCommerce plugins add timing constraints:

- Do not resolve order services before `woocommerce_init` / confirmed WooCommerce load
- Prefer repositories that accept order IDs and use CRUD / HPOS-safe APIs over reaching into `postmeta` from domain services
- Keep payment gateway classes thin: WooCommerce wants a gateway object, but your capture/refund logic can live in injectable services the gateway delegates to

Sketch:

```php
final class MyGateway extends WC_Payment_Gateway {
    public function __construct(
        private PaymentProcessor $processor,
        private Settings $settings
    ) {
        $this->id = 'my_gateway';
        // title, supports, form fields from $settings
    }

    public function process_payment( $order_id ) {
        $result = $this->processor->charge( (int) $order_id );
        return $result->to_woocommerce_array();
    }
}
```

WooCommerce may still want gateways registered through its payment gateways filter. Your composition root can return a pre-wired instance instead of letting WooCommerce `new` an empty class — or you inject into a gateway that lazily resolves from the container **once** in its constructor path. Pick one strategy and stick to it; dual construction paths are how you get “works in admin, null in checkout.”

## Testing without booting WordPress

The payoff for DI is tests that do not require a full WP install for domain logic.

```php
public function test_exporter_sends_mapped_payload(): void {
    $orders = new InMemoryOrderRepository( [
        42 => [ 'total' => '10.00', 'currency' => 'EUR' ],
    ] );
    $client = new RecordingApiClient();
    $logger = new NullLogger();

    ( new OrderExporter( $orders, $client, $logger ) )->export( 42 );

    $this->assertSame( '10.00', $client->last_payload()['total'] );
}
```

You still need integration tests against WordPress for hooks, capabilities, and HPOS. Those stay fewer and slower. Unit tests cover the decisions.

If your team cannot run PHPUnit in CI yet, DI still helps: you can swap a `NullLogger` or `LoggingHttpClient` in staging via the composition root without editing feature classes.

## Migration path for a legacy plugin

Do not rewrite the plugin in one PR. I migrate in layers:

1. **Identify entry points** — admin pages, REST routes, cron, checkout hooks, gateway methods
2. **Introduce a container** and register the messy classes as factories that still construct internals the old way
3. **Extract one boundary** — usually HTTP or settings — behind an interface
4. **Push constructors outward** class by class; leave dead `get_instance()` methods until nothing calls them
5. **Delete singletons** when the graph is wired

A useful intermediate step is “poor man’s DI”: factory functions in one `bootstrap.php` file that return fully built objects, without a container class at all. When that file becomes painful, promote it to a container.

## Performance and autoloading

People worry that containers are slow. In WordPress admin and storefront requests, your cost center is almost never resolving ten services once. It is querying, remote HTTP, and loading unused code.

Practices that matter more than container micro-optimizations:

- **Composer PSR-4 autoload** instead of `require_once` trees
- **Lazy factories** so admin-only services never construct on the storefront
- **Conditional registration** — do not register Filament-style admin stacks on `wp-cron` requests
- **Avoid resolving the whole graph on every `init`** — resolve per feature when its hook runs, or resolve a thin `Hooks` facade once

```php
$container->set( AdminPages::class, function ( Container $c ) {
    return new AdminPages( $c->get( Settings::class ) );
});

add_action( 'admin_menu', function () use ( $container ) {
    $container->get( AdminPages::class )->register_menu();
});
```

Storefront traffic never touches `AdminPages`.

## What I refuse to put in the container

Not everything is a service.

- **Value objects** — money, SKUs, sanitized emails — construct them where you need them
- **WordPress primitives you do not own** — pass `WP_REST_Request` into a controller method; do not register “the current request” as a singleton
- **One-off script locals** in WP-CLI commands — inject the long-lived collaborators; keep argv parsing local

If you register “current user” as a mutable container entry, you will invent race conditions in tests and weirdness in cron.

## A checklist before you merge the architecture PR

- [ ] One composition root owns construction
- [ ] Feature classes declare dependencies in constructors (PHP 8 constructor property promotion is fine and readable)
- [ ] Hook callbacks live on small registrar classes, not closures that close over half the plugin
- [ ] HTTP, clock, and secrets are replaceable without editing callers
- [ ] Admin-only services are not resolved on the storefront
- [ ] At least one pure unit test exists for a former “untouchable” class
- [ ] No new `get_instance()` APIs for features you are actively migrating

## Closing

WordPress will keep being procedural at the edges. That is fine. Your plugin does not have to be a ball of yarn behind those edges.

Dependency injection in this ecosystem is less about purity and more about **change control**: when the payment provider changes, when HPOS becomes mandatory, when a merchant needs a sandbox key overnight, when a junior engineer needs to test refund logic without a full site — you want the blast radius to be the composition root, not thirty files that all knew how to `new` an HTTP client.

Start with one feature. Wire it honestly. Delete one singleton. The rest of the plugin gets easier to tell the truth about — and plugins that tell the truth about their dependencies are the ones I still want to maintain two years later.
