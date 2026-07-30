<?php

declare(strict_types=1);

use App\Exceptions\ApiException;
use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\EnsureCompanyActive;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\ResolveTenant;
use App\Support\ApiResponse;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        apiPrefix: 'api',
    )
    ->withBroadcasting(
        __DIR__ . '/../routes/channels.php',
        attributes: ['prefix' => 'api/hrms', 'middleware' => ['api', 'auth:api']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [ForceJsonResponse::class]);

        $middleware->alias([
            'tenant' => ResolveTenant::class,
            'company.active' => EnsureCompanyActive::class,
            'super.admin' => EnsureSuperAdmin::class,
            'permission' => CheckPermission::class,
        ]);

        $middleware->prependToPriorityList(SubstituteBindings::class, EnsureCompanyActive::class);
        $middleware->prependToPriorityList(EnsureCompanyActive::class, ResolveTenant::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (): bool => true);

        $exceptions->render(fn (ApiException $e) => ApiResponse::error($e->getMessage(), $e->status(), $e->errorCode()));

        $exceptions->render(fn (ValidationException $e) => ApiResponse::error(
            'The given data was invalid.',
            422,
            'VALIDATION_FAILED',
            $e->errors()
        ));

        $exceptions->render(fn (AuthenticationException $e) => ApiResponse::error(
            'Unauthenticated. A valid bearer token is required.',
            401,
            'UNAUTHENTICATED'
        ));

        $exceptions->render(fn (ModelNotFoundException $e) => ApiResponse::error('Resource not found.', 404, 'RESOURCE_NOT_FOUND'));

        $exceptions->render(fn (ThrottleRequestsException $e) => ApiResponse::error(
            'Too many requests. Please slow down.',
            429,
            'TOO_MANY_REQUESTS'
        ));

        $exceptions->render(fn (AccessDeniedHttpException $e) => ApiResponse::error('This action is forbidden.', 403, 'FORBIDDEN'));

        $exceptions->render(fn (MethodNotAllowedHttpException $e) => ApiResponse::error(
            'This HTTP method is not supported for this endpoint.',
            405,
            'METHOD_NOT_ALLOWED'
        ));

        $exceptions->render(function (NotFoundHttpException $e) {
            if ($e->getPrevious() instanceof ModelNotFoundException) {
                return ApiResponse::error('Resource not found.', 404, 'RESOURCE_NOT_FOUND');
            }

            return ApiResponse::error('Endpoint not found.', 404, 'ENDPOINT_NOT_FOUND');
        });

        $exceptions->render(function (Throwable $e) {
            if (config('app.debug')) {
                return ApiResponse::error($e->getMessage(), 500, 'SERVER_ERROR', [
                    'exception' => $e::class,
                    'file' => $e->getFile() . ':' . $e->getLine(),
                ]);
            }

            return ApiResponse::error('An unexpected error occurred.', 500, 'SERVER_ERROR');
        });
    })->create();
