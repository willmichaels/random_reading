"""
FastAPI app for Vercel deployment.
Handles auth and read-log API only. Static files served from public/ by Vercel.
"""

import os

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, RedirectResponse

from auth import (
    SESSION_COOKIE,
    get_currently_reading,
    get_link_lists,
    get_log,
    get_presets,
    get_user_links,
    login as auth_login,
    logout as auth_logout,
    register as auth_register,
    save_currently_reading,
    save_link_lists,
    save_log,
    save_presets,
    save_user_links,
    verify_session,
)

app = FastAPI(title="Random Technical Wiki API", version="1.0.0")


@app.get("/")
async def root():
    return RedirectResponse("/index.html")


@app.get("/api/redis-status")
async def redis_status():
    """Debug: show which Redis env vars are available (keys only, no values)."""
    redis_keys = [
        "REDIS_URL",
        "storage_REDIS_URL",
        "KV_REST_API_URL",
        "storage_KV_REST_API_URL",
        "KV_REST_API_TOKEN",
        "storage_KV_REST_API_TOKEN",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
    ]
    return {
        k: "set" if (os.environ.get(k) or "").strip() else "empty"
        for k in redis_keys
    }


@app.post("/api/register")
async def api_register(request: Request):
    try:
        body = await request.json()
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        err = auth_register(username, password)
        if err:
            return JSONResponse({"error": err}, status_code=400)
        return JSONResponse({"ok": True})
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=503)
    except Exception as e:
        return JSONResponse({"error": f"Storage error: {e}"}, status_code=503)


@app.post("/api/login")
async def api_login(request: Request):
    try:
        body = await request.json()
        username = (body.get("username") or "").strip()
        password = body.get("password") or ""
        session_id = auth_login(username, password)
        if not session_id:
            return JSONResponse({"error": "Invalid username or password"}, status_code=401)
        response = JSONResponse({"ok": True, "username": username})
        response.set_cookie(
            key=SESSION_COOKIE,
            value=session_id,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,
        )
        return response
    except (ValueError, Exception) as e:
        return JSONResponse({"error": str(e) if isinstance(e, ValueError) else f"Storage error: {e}"}, status_code=503)


@app.post("/api/logout")
async def api_logout(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    auth_logout(session_id)
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE)
    return response


@app.get("/api/me")
async def api_me(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"username": None})
    return JSONResponse({"username": username})


@app.get("/api/read-log")
async def api_get_read_log(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    log = get_log(username)
    return JSONResponse({"log": log})


@app.post("/api/read-log")
async def api_save_read_log(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    body = await request.json()
    log = body.get("log", [])
    if not isinstance(log, list):
        return JSONResponse({"error": "Invalid log"}, status_code=400)
    save_log(username, log)
    return JSONResponse({"ok": True})


@app.get("/api/user-links")
async def api_get_user_links(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    links = get_user_links(username)
    return JSONResponse({"links": links})


@app.post("/api/user-links")
async def api_save_user_links(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    body = await request.json()
    links = body.get("links", [])
    if not isinstance(links, list):
        return JSONResponse({"error": "Invalid links"}, status_code=400)
    save_user_links(username, links)
    return JSONResponse({"ok": True})


@app.get("/api/link-lists")
async def api_get_link_lists(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    link_lists = get_link_lists(username)
    return JSONResponse({"linkLists": link_lists})


@app.post("/api/link-lists")
async def api_save_link_lists(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    body = await request.json()
    link_lists = body.get("linkLists", [])
    if not isinstance(link_lists, list):
        return JSONResponse({"error": "Invalid link lists"}, status_code=400)
    save_link_lists(username, link_lists)
    return JSONResponse({"ok": True})


@app.get("/api/presets")
async def api_get_presets(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    presets = get_presets(username)
    return JSONResponse({"presets": presets})


@app.post("/api/presets")
async def api_save_presets(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    body = await request.json()
    presets = body.get("presets", [])
    if not isinstance(presets, list):
        return JSONResponse({"error": "Invalid presets"}, status_code=400)
    save_presets(username, presets)
    return JSONResponse({"ok": True})


@app.get("/api/currently-reading")
async def api_get_currently_reading(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    items = get_currently_reading(username)
    return JSONResponse({"items": items})


@app.post("/api/currently-reading")
async def api_save_currently_reading(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    username = verify_session(session_id)
    if not username:
        return JSONResponse({"error": "Not logged in"}, status_code=401)
    body = await request.json()
    items = body.get("items", [])
    if not isinstance(items, list):
        return JSONResponse({"error": "Invalid items"}, status_code=400)
    save_currently_reading(username, items)
    return JSONResponse({"ok": True})
