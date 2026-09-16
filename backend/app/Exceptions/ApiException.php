<?php

declare(strict_types=1);

namespace App\Exceptions;

use Exception;

class ApiException extends Exception
{
    public function __construct(
        string $message,
        private readonly int $status = 400,
        private readonly ?string $errorCode = null,
        private readonly array $errors = []
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errorCode(): ?string
    {
        return $this->errorCode;
    }

    public function errors(): array
    {
        return $this->errors;
    }
}
