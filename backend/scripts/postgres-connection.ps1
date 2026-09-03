function Get-PostgresConnectionArgument {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl
  )

  try {
    $uri = [Uri]$DatabaseUrl
  } catch {
    throw 'DATABASE_URL must be a valid PostgreSQL connection URL.'
  }

  if ($uri.Scheme -notin @('postgres', 'postgresql') -or [string]::IsNullOrWhiteSpace($uri.Host)) {
    throw 'DATABASE_URL must use the postgres:// or postgresql:// scheme and include a host.'
  }

  $userInfo = $uri.UserInfo
  if ([string]::IsNullOrWhiteSpace($userInfo)) {
    throw 'DATABASE_URL must include a database username.'
  }

  $separator = $userInfo.IndexOf(':')
  $usernamePart = if ($separator -ge 0) { $userInfo.Substring(0, $separator) } else { $userInfo }
  $passwordPart = if ($separator -ge 0) { $userInfo.Substring($separator + 1) } else { $null }
  $username = [Uri]::UnescapeDataString($usernamePart)
  if ([string]::IsNullOrWhiteSpace($username)) {
    throw 'DATABASE_URL must include a non-empty database username.'
  }

  # Keep the password out of the pg_dump/pg_restore command line. libpq reads
  # PGPASSWORD from the child environment instead.
  if ($null -ne $passwordPart) {
    $env:PGPASSWORD = [Uri]::UnescapeDataString($passwordPart)
  }

  $safeUri = [UriBuilder]$uri
  $safeUri.UserName = $username
  $safeUri.Password = ''
  return "--dbname=$($safeUri.Uri.AbsoluteUri)"
}
