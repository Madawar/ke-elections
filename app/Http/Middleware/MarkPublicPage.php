<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Marks a map page as safe to keep offline. Inertia pages embed the signed-in user in their
 * props, so only a guest's copy may be stored: the service worker and warmPages() cache a page
 * only when this header is present (see resources/js/lib/pwa/warmPages.ts).
 */
class MarkPublicPage
{
    public const HEADER = 'X-Public-Page';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        if ($request->user() === null) {
            $response->headers->set(self::HEADER, '1');
        }

        return $response;
    }
}
