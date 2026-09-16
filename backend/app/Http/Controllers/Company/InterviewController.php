<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Http\Resources\InterviewResource;
use App\Models\Application;
use App\Models\Interview;
use App\Services\InterviewService;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InterviewController extends ApiController
{
    public function __construct(private readonly InterviewService $interviews) {}

    public function index(Request $request): JsonResponse
    {
        $interviews = Interview::query()
            ->with(['interviewer', 'application.candidate', 'application.opening'])
            ->when(
                $request->filled('status'),
                fn (Builder $query): Builder => $query->where('status', $request->string('status')->toString())
            )
            ->when(
                $request->filled('interviewer_id'),
                fn (Builder $query): Builder => $query->where('interviewer_id', $request->integer('interviewer_id'))
            )
            ->when(
                $request->filled('from'),
                fn (Builder $query): Builder => $query->whereDate('scheduled_at', '>=', $request->date('from'))
            )
            ->when(
                $request->filled('to'),
                fn (Builder $query): Builder => $query->whereDate('scheduled_at', '<=', $request->date('to'))
            )
            ->orderBy('scheduled_at')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($interviews, InterviewResource::class, 'Interviews fetched successfully');
    }

    public function mine(Request $request): JsonResponse
    {
        $interviews = Interview::query()
            ->with(['interviewer', 'application.candidate', 'application.opening'])
            ->where('interviewer_id', $request->user()->id)
            ->when(
                ! $request->boolean('all'),
                fn (Builder $query): Builder => $query->where('status', Interview::STATUS_SCHEDULED)
            )
            ->orderBy('scheduled_at')
            ->paginate($this->perPage($request));

        return ApiResponse::paginated($interviews, InterviewResource::class, 'Your interviews fetched successfully');
    }

    public function forApplication(Application $application): JsonResponse
    {
        return ApiResponse::success(
            InterviewResource::collection(
                $application->interviews()->with('interviewer')->orderBy('round_no')->get()
            ),
            'Interview rounds fetched successfully'
        );
    }

    public function store(Request $request, Application $application): JsonResponse
    {
        $data = $this->validateSlot($request, true);

        return ApiResponse::created(
            new InterviewResource(
                $this->interviews->schedule($application, $data, $request->user())
                    ->load(['interviewer', 'application.candidate', 'application.opening'])
            ),
            'Interview scheduled. The interviewer has been told and the candidate has the joining link.'
        );
    }

    public function update(Request $request, Interview $interview): JsonResponse
    {
        $data = $this->validateSlot($request, false);

        return ApiResponse::success(
            new InterviewResource(
                $this->interviews->reschedule($interview, $data, $request->user())
                    ->load(['interviewer', 'application.candidate', 'application.opening'])
            ),
            'Interview moved. Everyone has been told.'
        );
    }

    public function feedback(Request $request, Interview $interview): JsonResponse
    {
        if (
            (int) $interview->interviewer_id !== (int) $request->user()->id
            && ! $request->user()->hasPermission('recruitment.manage')
        ) {
            throw new ApiException('Only the interviewer can put in this feedback.', 403, 'NOT_THE_INTERVIEWER');
        }

        $data = $request->validate([
            'status' => ['sometimes', Rule::in([Interview::STATUS_DONE, Interview::STATUS_NO_SHOW])],
            'verdict' => ['required_if:status,done', 'nullable', Rule::in(Interview::VERDICTS)],
            'rating' => ['nullable', 'integer', 'between:1,5'],
            'feedback' => ['required_if:status,done', 'nullable', 'string', 'max:4000'],
        ], [
            'verdict.required_if' => 'Say whether the candidate is selected, rejected or on hold.',
            'feedback.required_if' => 'Write a few lines on how the round went.',
        ]);

        return ApiResponse::success(
            new InterviewResource(
                $this->interviews->submit($interview, $data, $request->user())
                    ->load(['interviewer', 'application.candidate', 'application.opening'])
            ),
            'Feedback saved'
        );
    }

    public function cancel(Request $request, Interview $interview): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        return ApiResponse::success(
            new InterviewResource(
                $this->interviews->cancel($interview, $data['reason'] ?? null, $request->user())
                    ->load(['interviewer', 'application.candidate', 'application.opening'])
            ),
            'Interview cancelled'
        );
    }

    private function validateSlot(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        $data = $request->validate([
            'round_no' => ['sometimes', 'integer', 'between:1,20'],
            'title' => ['nullable', 'string', 'max:150'],
            'kind' => ['sometimes', Rule::in(Interview::KINDS)],
            'mode' => ['sometimes', Rule::in(Interview::MODES)],
            'interviewer_id' => [$creating ? 'required' : 'sometimes', 'integer', Rule::exists('users', 'id')
                ->where('company_id', $this->tenantId())
                ->where('status', 'active')],
            'scheduled_at' => [$required, 'date', 'after:now'],
            'duration_minutes' => ['sometimes', 'integer', 'between:10,480'],
            'location' => ['nullable', 'string', 'max:200'],
        ], [
            'scheduled_at.after' => 'Pick a time in the future.',
            'interviewer_id.exists' => 'That interviewer is not an active user in this company.',
        ]);

        if (($data['mode'] ?? null) === Interview::MODE_IN_PERSON && ($data['location'] ?? null) === null) {
            throw new ApiException('An in-person round needs a place.', 422, 'LOCATION_REQUIRED');
        }

        return $data;
    }
}
