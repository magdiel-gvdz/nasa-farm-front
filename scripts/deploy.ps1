param(
    [ValidateSet('prod')][string]$Environment = 'prod',
    [string]$AwsProfile = '',
    [string]$StateBucket = 'nasa-farm-terraform-state-028610956742'
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$previousProfile = $env:AWS_PROFILE

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

Push-Location $repo
try {
    if (git status --porcelain) { throw 'Commit local changes before publishing a release.' }
    $commit = (git rev-parse HEAD).Trim()
    if ($AwsProfile) { $env:AWS_PROFILE = $AwsProfile }
    # Read outputs from the existing state without applying infrastructure changes.
    $state = & aws s3 cp "s3://$StateBucket/$Environment/terraform.tfstate" '-' --no-progress
    if ($LASTEXITCODE -ne 0) { throw 'Could not read the existing infrastructure state.' }
    $target = (($state -join "`n") | ConvertFrom-Json).outputs
    $bucket = $target.bucket_name.value
    $distribution = $target.distribution_id.value
    $url = $target.cloudfront_url.value
    if ($bucket -ne "nasa-farm-$Environment-website" -or !$distribution -or !$url) { throw 'Infrastructure outputs do not match the requested environment.' }
    $origins = & aws cloudfront get-distribution --id $distribution --query 'Distribution.DistributionConfig.Origins.Items[].DomainName' --output json
    if ($LASTEXITCODE -ne 0 -or (($origins -join "`n") | ConvertFrom-Json) -notcontains "$bucket.s3.us-east-1.amazonaws.com") { throw 'CloudFront does not serve the expected bucket.' }

    Push-Location (Join-Path $repo 'app')
    try { Invoke-Checked 'npm.cmd' @('run', 'build') } finally { Pop-Location }
    $release = @{ commit = $commit; environment = $Environment; deployed_at = [DateTime]::UtcNow.ToString('o') } | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $repo 'app/dist/deployment.json'), $release, [Text.UTF8Encoding]::new($false))

    # Publish versioned assets first; retain older hashes for already-open browser tabs.
    Invoke-Checked 'aws' @('s3', 'sync', 'app/dist/assets/', "s3://$bucket/assets/", '--exclude', '*.mjs', '--cache-control', 'public,max-age=31536000,immutable', '--no-progress')
    Invoke-Checked 'aws' @('s3', 'sync', 'app/dist/assets/', "s3://$bucket/assets/", '--exclude', '*', '--include', '*.mjs', '--content-type', 'text/javascript', '--cache-control', 'public,max-age=31536000,immutable', '--no-progress')
    Invoke-Checked 'aws' @('s3', 'sync', 'app/dist/', "s3://$bucket/", '--exclude', 'assets/*', '--exclude', 'index.html', '--cache-control', 'no-cache,no-store,must-revalidate', '--no-progress')
    Invoke-Checked 'aws' @('s3', 'cp', 'app/dist/index.html', "s3://$bucket/index.html", '--content-type', 'text/html', '--cache-control', 'no-cache,no-store,must-revalidate', '--no-progress')
    $invalidation = & aws cloudfront create-invalidation --distribution-id $distribution --paths '/*' --query 'Invalidation.Id' --output text
    if ($LASTEXITCODE -ne 0) { throw 'Could not invalidate CloudFront.' }
    Invoke-Checked 'aws' @('cloudfront', 'wait', 'invalidation-completed', '--distribution-id', $distribution, '--id', $invalidation.Trim())
    Write-Output "Published $commit to $Environment`: $url"
} finally {
    $env:AWS_PROFILE = $previousProfile
    Pop-Location
}
