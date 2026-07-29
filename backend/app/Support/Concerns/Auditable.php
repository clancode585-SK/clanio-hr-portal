<?php

declare(strict_types=1);

namespace App\Support\Concerns;

use App\Models\AuditLog;
use Illuminate\Support\Arr;

trait Auditable
{
    public static function bootAuditable(): void
    {
        static::created(function ($model): void {
            AuditLog::record('created', $model, [], $model->auditable($model->getAttributes()));
        });

        static::updated(function ($model): void {
            $changes = $model->getChanges();
            $original = Arr::only($model->getOriginal(), array_keys($changes));

            AuditLog::record('updated', $model, $model->auditable($original), $model->auditable($changes));
        });

        static::deleted(function ($model): void {
            AuditLog::record('deleted', $model, $model->auditable($model->getAttributes()), []);
        });
    }

    public function auditable(array $values): array
    {
        return Arr::except($values, $this->auditExcluded());
    }

    protected function auditExcluded(): array
    {
        return array_merge(
            ['password', 'remember_token', 'company_key', 'shift_key', 'holiday_key', 'open_key', 'created_at', 'updated_at'],
            $this->auditSensitive()
        );
    }

    protected function auditSensitive(): array
    {
        return [];
    }
}
