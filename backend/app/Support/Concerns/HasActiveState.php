<?php

declare(strict_types=1);

namespace App\Support\Concerns;

use App\Support\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Builder;

trait HasActiveState
{
    public static function bootHasActiveState(): void
    {
        static::addGlobalScope(new ActiveScope());
    }

    public function initializeHasActiveState(): void
    {
        $this->mergeCasts(['is_active' => 'boolean']);
        $this->attributes['is_active'] = 1;
    }

    public function scopeWithInactive(Builder $query): Builder
    {
        return $query->withoutGlobalScope(ActiveScope::class);
    }

    public function scopeOnlyInactive(Builder $query): Builder
    {
        return $query->withoutGlobalScope(ActiveScope::class)
            ->where($this->qualifyColumn('is_active'), 0);
    }

    public function deactivate(): bool
    {
        return $this->forceFill(['is_active' => false])->save();
    }

    public function activate(): bool
    {
        return $this->forceFill(['is_active' => true])->save();
    }
}
