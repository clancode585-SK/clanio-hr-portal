<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ClearanceItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExitClearanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $actor = $request->user();

        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'employee_exit_id' => (int) $this->employee_exit_id,
            'department' => $this->department,
            'department_label' => $this->departmentLabel(),
            'title' => $this->title,
            'is_recoverable' => $this->is_recoverable,
            'is_mandatory' => $this->is_mandatory,
            'status' => $this->status,
            'remarks' => $this->remarks,
            'recoverable_amount' => (float) $this->recoverable_amount,
            'blocks_exit' => $this->blocksExit(),
            'cleared_by' => $this->cleared_by === null ? null : (int) $this->cleared_by,
            'cleared_by_name' => $this->clearedBy?->name,
            'cleared_at' => $this->cleared_at,
            'can_sign' => (bool) $actor?->hasPermission(ClearanceItem::SIGN_PERMISSION),
            'updated_at' => $this->updated_at,
        ];
    }
}
