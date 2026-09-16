<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Request;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function changeList(): array
    {
        $old = $this->old_values ?? [];
        $new = $this->new_values ?? [];
        $fields = array_values(array_unique([...array_keys($old), ...array_keys($new)]));

        sort($fields);

        return array_map(fn (string $field): array => [
            'field' => $field,
            'label' => ucfirst(str_replace('_', ' ', $field)),
            'from' => self::readable($old[$field] ?? null),
            'to' => self::readable($new[$field] ?? null),
        ], $fields);
    }

    private static function readable(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_array($value)) {
            return (string) json_encode($value);
        }

        return (string) $value;
    }

    protected function casts(): array
    {
        return [
            'old_values' => 'array',
            'new_values' => 'array',
        ];
    }

    public static function record(string $event, Model $model, array $oldValues, array $newValues): void
    {
        $actor = auth()->user();

        self::create([
            'company_id' => $model->getAttribute('company_id') ?? $actor?->company_id,
            'user_id' => $actor?->id,
            'event' => $event,
            'auditable_type' => class_basename($model),
            'auditable_id' => $model->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => Request::ip(),
        ]);
    }
}
