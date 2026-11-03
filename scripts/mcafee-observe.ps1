param(
  [string]$Click,
  [string]$ControlType,
  [int]$Index = 0,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9-]+$')][string]$Record,
  [int]$Limit = 120
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$top = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
  [System.Windows.Automation.TreeScope]::Children,
  [System.Windows.Automation.Condition]::TrueCondition)
$window = $top | Where-Object {
  $_.Current.Name -like 'McAfee*' -and $_.Current.ClassName -eq 'Chrome_WidgetWin_1' -and
  (Get-Process -Id $_.Current.ProcessId).ProcessName -eq 'msedgewebview2'
} | Select-Object -First 1
if (!$window) { throw 'The McAfee WebView2 accessibility window is not open.' }
if ($Click) {
  $candidates = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::NameProperty, $Click)) |
    Where-Object { (!$ControlType -or $_.Current.ControlType.ProgrammaticName -eq "ControlType.$ControlType") })
  if ($candidates.Count -le $Index) { throw 'Requested visible control is absent.' }
  if ($candidates[$Index].Current.IsOffscreen) {
    $scroll = $null
    if ($candidates[$Index].TryGetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern, [ref]$scroll)) {
      $scroll.ScrollIntoView()
    }
  }
  $invoke = $null
  if ($candidates[$Index].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)) {
    $invoke.Invoke()
  } else {
    $expand = $null
    $select = $null
    if ($candidates[$Index].TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$expand)) {
      $expand.Expand()
    } elseif ($ControlType -eq 'TabItem' -and $candidates[$Index].TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$select)) {
      $select.Select()
    } else {
      throw 'Control does not support navigation patterns; no pointer or toggle fallback was performed.'
    }
  }
  Start-Sleep -Milliseconds 700
}
$rows = @($window.FindAll([System.Windows.Automation.TreeScope]::Descendants,
  [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object {
  if ($_.Current.Name -and $_.Current.ControlType.ProgrammaticName -ne 'ControlType.Image') {
    [pscustomobject]@{ type=$_.Current.ControlType.ProgrammaticName; name=$_.Current.Name; offscreen=$_.Current.IsOffscreen; enabled=$_.Current.IsEnabled }
  }
})
$recordData = [ordered]@{
  kind='windows-uia-observation'; timestamp_utc=[DateTime]::UtcNow.ToString('o')
  window_title=$window.Current.Name
  action=if($Click){[ordered]@{invoke_name=$Click;control_type=$ControlType;index=$Index}}else{$null}
  rows=$rows
  limitations=@('Accessible labels and displayed states only; no execution tracing or efficacy measurement.', 'No edit values are read. Private evidence may still contain account labels and stays outside version control.')
}
$private = Join-Path (Split-Path $PSScriptRoot -Parent) 'research\private'
New-Item -ItemType Directory -Force -Path $private | Out-Null
$path = Join-Path $private ("uia-$Record.json")
if (Test-Path -LiteralPath $path) { throw 'Evidence record exists; select a new record name.' }
$recordData | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
[pscustomobject]@{observation_id=('uia_'+(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant());record=$Record;rows=$rows.Count} | ConvertTo-Json -Compress
$rows | Select-Object -First $Limit | ConvertTo-Json -Depth 3 -Compress
