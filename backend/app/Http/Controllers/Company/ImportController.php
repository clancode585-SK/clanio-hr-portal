<?php

declare(strict_types=1);

namespace App\Http\Controllers\Company;

use App\Exceptions\ApiException;
use App\Http\Controllers\ApiController;
use App\Services\ImportService;
use App\Support\ApiResponse;
use App\Support\ImportModules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportController extends ApiController
{
    public function __construct(private readonly ImportService $imports) {}

    public function modules(Request $request): JsonResponse
    {
        $user = $request->user();

        $modules = [];

        foreach (ImportModules::all() as $key => $definition) {
            $modules[] = [
                'module' => $key,
                'label' => $definition['label'],
                'step' => $definition['step'],
                'hint' => $definition['hint'],
                'needs' => $definition['needs'] ?? [],
                'allowed' => $user->hasPermission($definition['permission']),
                'columns' => array_map(
                    static fn (string $column, array $rules): array => [
                        'name' => $column,
                        'required' => (bool) ($rules['required'] ?? false),
                        'note' => (string) ($rules['note'] ?? ''),
                    ],
                    array_keys($definition['columns']),
                    array_values($definition['columns'])
                ),
            ];
        }

        return ApiResponse::success($modules, 'Import modules fetched successfully');
    }

    public function sample(Request $request, string $module): StreamedResponse
    {
        $definition = ImportModules::find($module);

        if ($definition === null) {
            abort(404);
        }

        $headers = ImportModules::headers($module);
        $sample = ImportModules::sampleRow($module);

        return response()->streamDownload(
            static function () use ($headers, $sample): void {
                $handle = fopen('php://output', 'w');
                fputcsv($handle, $headers);
                fputcsv($handle, array_values($sample));
                fclose($handle);
            },
            $module . '-sample.csv',
            ['Content-Type' => 'text/csv']
        );
    }

    public function store(Request $request, string $module): JsonResponse
    {
        $definition = ImportModules::find($module);

        if ($definition === null) {
            throw new ApiException('That module cannot be imported.', 422, 'IMPORT_MODULE_UNKNOWN');
        }

        if (! $request->user()->hasPermission($definition['permission'])) {
            throw new ApiException(
                'You do not have permission to import ' . strtolower($definition['label']) . '.',
                403,
                'PERMISSION_DENIED'
            );
        }

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $companyId = $this->tenantId();

        if ($companyId === null) {
            throw new ApiException('Choose a company before importing.', 422, 'TENANT_REQUIRED');
        }

        $result = $this->imports->run($module, $request->file('file'), $request->user(), $companyId);

        return ApiResponse::success(
            $result,
            $result['created'] . ' created, ' . $result['updated'] . ' updated, ' . $result['failed'] . ' failed'
        );
    }
}
