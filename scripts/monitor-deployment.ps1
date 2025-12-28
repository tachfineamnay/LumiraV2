#!/usr/bin/env pwsh
# Lumira V2 Deployment Monitoring Script
# Usage: .\monitor-deployment.ps1 -ApiUrl "https://api.oraclelumira.com" -WebUrl "https://desk.oraclelumira.com"

param(
    [string]$ApiUrl = "https://api.oraclelumira.com",
    [string]$WebUrl = "https://desk.oraclelumira.com",
    [string]$MainWebUrl = "https://oraclelumira.com"
)

Write-Host "🚀 Lumira V2 Deployment Monitor" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$results = @{
    api = @{}
    web = @{}
    routing = @{}
}

# ========================================
# ÉTAPE 1: API HEALTH CHECK
# ========================================
Write-Host "📡 ÉTAPE 1: API Health Check" -ForegroundColor Yellow
Write-Host "----------------------------" -ForegroundColor Yellow

try {
    $apiHealth = Invoke-RestMethod -Uri "$ApiUrl/api/health" -Method Get -TimeoutSec 10
    Write-Host "✅ API is HEALTHY" -ForegroundColor Green
    Write-Host "   Status: $($apiHealth.status)" -ForegroundColor Gray
    $results.api.health = "OK"
} catch {
    Write-Host "❌ API Health Check FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    $results.api.health = "FAILED: $($_.Exception.Message)"
}

Write-Host ""

# ========================================
# ÉTAPE 2: WEB APPLICATION CHECK
# ========================================
Write-Host "🌐 ÉTAPE 2: WEB Application Check" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow

try {
    $webResponse = Invoke-WebRequest -Uri $WebUrl -Method Get -TimeoutSec 10
    if ($webResponse.StatusCode -eq 200) {
        Write-Host "✅ WEB is ACCESSIBLE (Status: $($webResponse.StatusCode))" -ForegroundColor Green
        $results.web.access = "OK"
    } else {
        Write-Host "⚠️ WEB returned unexpected status: $($webResponse.StatusCode)" -ForegroundColor Yellow
        $results.web.access = "WARNING: Status $($webResponse.StatusCode)"
    }
} catch {
    Write-Host "❌ WEB Access FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    $results.web.access = "FAILED: $($_.Exception.Message)"
}

Write-Host ""

# ========================================
# ÉTAPE 3: MIDDLEWARE ROUTING TEST
# ========================================
Write-Host "🔀 ÉTAPE 3: Middleware Routing Test" -ForegroundColor Yellow
Write-Host "-----------------------------------" -ForegroundColor Yellow

# Test 3.1: Desk Domain Rewrite
Write-Host "Test 3.1: Desk Domain → /admin rewrite" -ForegroundColor Cyan
try {
    $deskResponse = Invoke-WebRequest -Uri "$WebUrl/" -Method Get -TimeoutSec 10 -MaximumRedirection 0
    
    # Check if middleware headers are present
    $middlewareHeader = $deskResponse.Headers['x-middleware-rewrite']
    if ($middlewareHeader) {
        Write-Host "✅ Middleware Rewrite Detected" -ForegroundColor Green
        Write-Host "   Header: $middlewareHeader" -ForegroundColor Gray
        $results.routing.deskRewrite = "OK"
    } else {
        Write-Host "⚠️ No explicit middleware header found, but page loads" -ForegroundColor Yellow
        $results.routing.deskRewrite = "PARTIAL"
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 200) {
        Write-Host "✅ Desk domain accessible" -ForegroundColor Green
        $results.routing.deskRewrite = "OK"
    } else {
        Write-Host "❌ Desk Routing Test FAILED" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $results.routing.deskRewrite = "FAILED"
    }
}

Write-Host ""

# Test 3.2: Sanctuaire Blocking
Write-Host "Test 3.2: Sanctuaire Access Blocking from Desk" -ForegroundColor Cyan
try {
    $sanctuaireBlock = Invoke-WebRequest -Uri "$WebUrl/sanctuaire" -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "❌ CRITICAL: Sanctuaire is ACCESSIBLE from Desk (should be 404)" -ForegroundColor Red
    $results.routing.sanctuaireBlock = "FAILED: NOT BLOCKED"
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ Sanctuaire correctly BLOCKED (404)" -ForegroundColor Green
        $results.routing.sanctuaireBlock = "OK"
    } else {
        Write-Host "⚠️ Unexpected status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
        $results.routing.sanctuaireBlock = "PARTIAL: Status $($_.Exception.Response.StatusCode)"
    }
}

Write-Host ""

# ========================================
# ÉTAPE 4: CORS VALIDATION
# ========================================
Write-Host "🔐 ÉTAPE 4: CORS Validation" -ForegroundColor Yellow
Write-Host "---------------------------" -ForegroundColor Yellow

try {
    $corsHeaders = @{
        "Origin" = $WebUrl
        "Content-Type" = "application/json"
    }
    
    $corsResponse = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method Options -Headers $corsHeaders -TimeoutSec 10 -ErrorAction SilentlyContinue
    
    $allowOrigin = $corsResponse.Headers['Access-Control-Allow-Origin']
    if ($allowOrigin -eq $WebUrl) {
        Write-Host "✅ CORS correctly configured for Desk domain" -ForegroundColor Green
        Write-Host "   Allowed Origin: $allowOrigin" -ForegroundColor Gray
        $results.routing.cors = "OK"
    } else {
        Write-Host "⚠️ CORS might have issues" -ForegroundColor Yellow
        Write-Host "   Expected: $WebUrl" -ForegroundColor Gray
        Write-Host "   Got: $allowOrigin" -ForegroundColor Gray
        $results.routing.cors = "WARNING: Origin mismatch"
    }
} catch {
    Write-Host "⚠️ CORS preflight not available (might be handled by POST)" -ForegroundColor Yellow
    $results.routing.cors = "NOT TESTED"
}

Write-Host ""

# ========================================
# SUMMARY
# ========================================
Write-Host "📊 DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""

Write-Host "API:" -ForegroundColor White
Write-Host "  Health: $($results.api.health)" -ForegroundColor $(if ($results.api.health -eq "OK") { "Green" } else { "Red" })

Write-Host ""
Write-Host "WEB:" -ForegroundColor White
Write-Host "  Access: $($results.web.access)" -ForegroundColor $(if ($results.web.access -eq "OK") { "Green" } else { "Red" })

Write-Host ""
Write-Host "ROUTING:" -ForegroundColor White
Write-Host "  Desk Rewrite: $($results.routing.deskRewrite)" -ForegroundColor $(if ($results.routing.deskRewrite -eq "OK") { "Green" } else { "Yellow" })
Write-Host "  Sanctuaire Block: $($results.routing.sanctuaireBlock)" -ForegroundColor $(if ($results.routing.sanctuaireBlock -eq "OK") { "Green" } else { "Red" })
Write-Host "  CORS: $($results.routing.cors)" -ForegroundColor $(if ($results.routing.cors -eq "OK") { "Green" } else { "Yellow" })

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan

# FAILURE CHECK
$failures = @()
if ($results.api.health -ne "OK") { $failures += "API Health" }
if ($results.web.access -ne "OK") { $failures += "WEB Access" }
if ($results.routing.sanctuaireBlock -notlike "OK*") { $failures += "Security (Sanctuaire blocking)" }

if ($failures.Count -eq 0) {
    Write-Host "✅ ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ FAILURES DETECTED:" -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host "   - $failure" -ForegroundColor Red
    }
    exit 1
}
