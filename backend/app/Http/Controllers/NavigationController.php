<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\ApiResponse;
use App\Support\Navigation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NavigationController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        return ApiResponse::success(
            ['groups' => Navigation::visibleFor($request->user())],
            'Navigation fetched successfully'
        );
    }
}
