<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeviceTokenResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'platform' => $this->platform,
            'token_preview' => $this->maskedToken(),
            'device_id' => $this->device_id,
            'device_name' => $this->device_name,
            'app_version' => $this->app_version,
            'is_active' => $this->revoked_at === null,
            'last_used_at' => $this->last_used_at,
            'created_at' => $this->created_at,
        ];
    }
}
