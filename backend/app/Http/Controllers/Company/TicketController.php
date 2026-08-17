<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Http\Controllers\ApiController;
use App\Http\Requests\TicketRequest;
use App\Http\Resources\TicketCommentResource;
use App\Http\Resources\TicketResource;
use App\Models\Ticket;
use App\Services\TicketService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TicketController extends ApiController
{
    public function __construct(private readonly TicketService $tickets) {}

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();

        $query = $this->applyFilters(
            Ticket::query()->visibleTo($actor)->with(['category', 'raiser', 'assignee', 'department'])->withCount('comments'),
            $request,
            ['ticket_no', 'subject'],
            [
                'status' => 'status',
                'priority' => 'priority',
                'scope' => 'scope',
                'category_id' => 'category_id',
                'assigned_to' => 'assigned_to',
                'raised_by' => 'raised_by',
                'department_id' => 'assigned_department_id',
            ]
        );

        $query->when($request->boolean('mine'), fn (Builder $inner) => $inner->where('raised_by', $actor->id))
            ->when($request->boolean('assigned_to_me'), fn (Builder $inner) => $inner->where('assigned_to', $actor->id))
            ->when($request->boolean('open_only'), fn (Builder $inner) => $inner->whereIn('status', [
                Ticket::OPEN, Ticket::IN_PROGRESS, Ticket::WAITING_ON_USER,
            ]))
            ->when($request->boolean('breached'), fn (Builder $inner) => $inner->where('resolution_breached', 1));

        return ApiResponse::paginated(
            $query->orderByRaw("FIELD(status, 'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed', 'cancelled')")
                ->orderBy('resolution_due_at')
                ->paginate($this->perPage($request)),
            TicketResource::class,
            'Tickets fetched successfully'
        );
    }

    public function summary(Request $request): JsonResponse
    {
        return ApiResponse::success($this->tickets->summary($request->user()), 'Ticket summary fetched successfully');
    }

    public function store(TicketRequest $request): JsonResponse
    {
        return ApiResponse::created(
            new TicketResource($this->tickets->raise($request->user(), $request->validated())),
            'Request bhej di gayi'
        );
    }

    public function show(Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($ticket->load([
                'category', 'route', 'raiser', 'assignee', 'department', 'resolver',
                'comments.author', 'comments.attachments', 'attachments',
            ])->loadCount('comments')),
            'Ticket details fetched successfully'
        );
    }

    public function claim(Request $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->claim($ticket, $request->user())),
            'Ticket aapke naam par hai'
        );
    }

    public function assign(TicketRequest $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->assign($ticket, $request->user(), (int) $request->validated()['user_id'])),
            'Ticket assign ho gaya'
        );
    }

    public function comment(TicketRequest $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::created(
            new TicketCommentResource($this->tickets->comment($ticket, $request->user(), $request->validated())),
            'Reply bhej diya'
        );
    }

    public function askInfo(TicketRequest $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->askInfo($ticket, $request->user(), $request->validated())),
            'Information maang li gayi'
        );
    }

    public function resolve(TicketRequest $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->resolve($ticket, $request->user(), $request->validated())),
            'Ticket resolve ho gaya'
        );
    }

    public function reopen(TicketRequest $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->reopen($ticket, $request->user(), $request->validated())),
            'Ticket dobara khul gaya'
        );
    }

    public function close(Request $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->close($ticket, $request->user())),
            'Ticket band ho gaya'
        );
    }

    public function cancel(Request $request, Ticket $ticket): JsonResponse
    {
        return ApiResponse::success(
            new TicketResource($this->tickets->cancel($ticket, $request->user())),
            'Request cancel ho gayi'
        );
    }
}
