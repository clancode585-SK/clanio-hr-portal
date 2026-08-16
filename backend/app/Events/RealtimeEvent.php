<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

final class RealtimeEvent implements ShouldBroadcastNow
{
    use Dispatchable;

    public function __construct(
        private readonly array $channels,
        private readonly string $event,
        private readonly array $payload
    ) {}

    public function broadcastOn(): array
    {
        return array_map(static fn (string $name): PrivateChannel => new PrivateChannel($name), $this->channels);
    }

    public function broadcastAs(): string
    {
        return $this->event;
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
