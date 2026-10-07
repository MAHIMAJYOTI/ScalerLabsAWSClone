from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.routes import api_router
from app.core.config import get_settings
from app.core.errors import ApiError


def _error_response(status_code: int, code: str, message: str, details: list) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details}},
    )


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Route 53 Console Clone API", version="0.1.0")

    origins = settings.cors_origins_list
    if "*" in origins:
        raise RuntimeError(
            "CORS_ORIGINS must list explicit origins — '*' is not allowed "
            "because cookies require allow_credentials=True."
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix="/api/v1")

    @app.middleware("http")
    async def no_store_api_responses(request: Request, call_next):
        """API responses are always dynamic — never cacheable by the browser
        or anything between it and us (e.g. the Next.js rewrite)."""
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        return _error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {
                "loc": ".".join(str(part) for part in err.get("loc", [])),
                "message": err.get("msg", "Invalid value"),
            }
            for err in exc.errors()
        ]
        return _error_response(422, "InvalidInput", "Request validation failed.", details)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = {401: "NotAuthenticated", 403: "AccessDenied", 404: "NotFound"}.get(
            exc.status_code, "InvalidInput"
        )
        return _error_response(exc.status_code, code, str(exc.detail), [])

    return app


app = create_app()
