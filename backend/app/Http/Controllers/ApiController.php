<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\TenantCache;
use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

abstract class ApiController extends Controller
{
    protected const DEFAULT_PER_PAGE = 25;

    protected const MAX_PER_PAGE = 100;

    protected function tenantId(): ?int
    {
        return app(TenantContext::class)->id();
    }

    protected function perPage(Request $request): int
    {
        return min(max($request->integer('per_page', self::DEFAULT_PER_PAGE), 1), self::MAX_PER_PAGE);
    }

    protected function cacheKey(Request $request): string
    {
        return TenantCache::signature($request->query());
    }

    protected function applyFilters(Builder $query, Request $request, array $searchable = [], array $filters = []): Builder
    {
        if ($searchable !== [] && $request->filled('search')) {
            $term = '%' . $request->string('search')->toString() . '%';

            $query->where(function (Builder $inner) use ($searchable, $term): void {
                foreach ($searchable as $column) {
                    $inner->orWhere($column, 'like', $term);
                }
            });
        }

        foreach ($filters as $parameter => $column) {
            $query->when(
                $request->filled($parameter),
                fn (Builder $inner): Builder => $inner->where($column, $request->input($parameter))
            );
        }

        return $query;
    }
}
