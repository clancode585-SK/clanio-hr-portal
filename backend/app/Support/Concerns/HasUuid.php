<?php

declare(strict_types=1);

namespace App\Support\Concerns;

use Illuminate\Support\Str;

trait HasUuid
{
    public static function bootHasUuid(): void
    {
        static::creating(function ($model): void {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function routeBindingColumn(mixed $value): string
    {
        return ctype_digit((string) $value) ? $this->getKeyName() : $this->getRouteKeyName();
    }

    public function resolveRouteBindingQuery($query, $value, $field = null)
    {
        $column = $field === null || $field === $this->getRouteKeyName()
            ? $this->routeBindingColumn($value)
            : $field;

        return $query->where($column, $value);
    }
}
