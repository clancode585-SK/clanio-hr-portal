<?php

declare(strict_types=1);

namespace App\Support\Scopes;

use App\Support\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

final class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $companyId = app(TenantContext::class)->id();
        $column = $model->qualifyColumn('company_id');

        $companyId === null
            ? $builder->whereNull($column)
            : $builder->where($column, $companyId);
    }
}
