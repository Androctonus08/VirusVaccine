/* VirusVaccine additions, licensed under MS-PL; see ../LICENSE.
 * Console development host. No service installation or elevation is performed.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <fltUser.h>
#include "utility.h"
#include "userscan.h"
#include "clambridge.h"
static HANDLE stopEvent;
static BOOL WINAPI Stop(DWORD reason) {UNREFERENCED_PARAMETER(reason);if(stopEvent)SetEvent(stopEvent);return TRUE;}
static SERVICE_STATUS_HANDLE serviceHandle;
static SERVICE_STATUS serviceStatus;
static void Report(DWORD state,DWORD error) {
    serviceStatus.dwServiceType=SERVICE_WIN32_OWN_PROCESS;
    serviceStatus.dwCurrentState=state;serviceStatus.dwWin32ExitCode=error;
    serviceStatus.dwControlsAccepted=state==SERVICE_RUNNING?SERVICE_ACCEPT_STOP|SERVICE_ACCEPT_SHUTDOWN:0;
    serviceStatus.dwWaitHint=(state==SERVICE_START_PENDING || state==SERVICE_STOP_PENDING)?30000:0;
    serviceStatus.dwCheckPoint=serviceStatus.dwWaitHint?serviceStatus.dwCheckPoint+1:0;
    SetServiceStatus(serviceHandle,&serviceStatus);
}
static void WINAPI ServiceControl(DWORD control) {
    if(control==SERVICE_CONTROL_STOP || control==SERVICE_CONTROL_SHUTDOWN){Report(SERVICE_STOP_PENDING,NO_ERROR);Stop(control);}
}
static void WINAPI ServiceMain(DWORD argc,wchar_t **argv) {
    USER_SCAN_CONTEXT context={0};HRESULT hr;unsigned long port,pid;
    serviceHandle=RegisterServiceCtrlHandlerW(L"VirusVaccineGuardAgent",ServiceControl);if(!serviceHandle)return;
    Report(SERVICE_START_PENDING,NO_ERROR);
    // An administrator must supply the separately supervised ClamAV process ID.
    // No engine path, user-writable config or shell command is executed by this service.
    if(argc!=4 || wcscmp(argv[3],L"--lab-only")){Report(SERVICE_STOPPED,ERROR_INVALID_PARAMETER);return;}
    port=wcstoul(argv[1],NULL,10);pid=wcstoul(argv[2],NULL,10);
    if(!port || port>65535 || !pid || !VvEngineConfigure((USHORT)port,(DWORD)pid)){Report(SERVICE_STOPPED,ERROR_SERVICE_DEPENDENCY_FAIL);return;}
    stopEvent=CreateEventW(NULL,TRUE,FALSE,NULL);if(!stopEvent){Report(SERVICE_STOPPED,GetLastError());return;}
    hr=UserScanInit(&context);if(FAILED(hr)){CloseHandle(stopEvent);stopEvent=NULL;Report(SERVICE_STOPPED,ERROR_SERVICE_DEPENDENCY_FAIL);return;}
    Report(SERVICE_RUNNING,NO_ERROR);WaitForSingleObject(stopEvent,INFINITE);UserScanFinalize(&context);
    CloseHandle(stopEvent);stopEvent=NULL;Report(SERVICE_STOPPED,NO_ERROR);
}
int wmain(int argc,wchar_t **argv) {
    unsigned long port,pid;HANDLE file,mapping;LARGE_INTEGER size;void *bytes=NULL;BOOLEAN cancel=FALSE;
    AVSCAN_RESULT result;USER_SCAN_CONTEXT context={0};HRESULT hr;
    if(argc==2 && !wcscmp(argv[1],L"--service")) {
        SERVICE_TABLE_ENTRYW services[]={{L"VirusVaccineGuardAgent",ServiceMain},{NULL,NULL}};
        return StartServiceCtrlDispatcherW(services)?0:2;
    }
    if(argc!=5 || (wcscmp(argv[1],L"--scan") && wcscmp(argv[1],L"--listen"))) {
        fwprintf(stderr,L"Development agent: --scan PORT CLAMD_PID FILE | --listen PORT CLAMD_PID --lab-only\n");return 2;
    }
    port=wcstoul(argv[2],NULL,10);pid=wcstoul(argv[3],NULL,10);
    if(!port || port>65535 || !pid || !VvEngineConfigure((USHORT)port,(DWORD)pid)) {fprintf(stderr,"ClamAV listener ownership could not be verified\n");return 2;}
    if(!wcscmp(argv[1],L"--listen")) {
        if(wcscmp(argv[4],L"--lab-only"))return 2;
        stopEvent=CreateEventW(NULL,TRUE,FALSE,NULL);if(!stopEvent)return 2;
        SetConsoleCtrlHandler(Stop,TRUE);hr=UserScanInit(&context);
        if(FAILED(hr)){fprintf(stderr,"The laboratory driver is not connected\n");CloseHandle(stopEvent);return 2;}
        puts("Laboratory scan agent connected. Press Ctrl+C to stop.");WaitForSingleObject(stopEvent,INFINITE);
        hr=UserScanFinalize(&context);CloseHandle(stopEvent);return FAILED(hr)?2:0;
    }
    file=CreateFileW(argv[4],GENERIC_READ,FILE_SHARE_READ,NULL,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT,NULL);
    if(file==INVALID_HANDLE_VALUE)return 2;
    {BY_HANDLE_FILE_INFORMATION info;if(!GetFileInformationByHandle(file,&info) || (info.dwFileAttributes&(FILE_ATTRIBUTE_REPARSE_POINT|FILE_ATTRIBUTE_DIRECTORY)) || !GetFileSizeEx(file,&size) || size.QuadPart<0 || size.QuadPart>128*1024*1024){CloseHandle(file);return 2;}}
    mapping=NULL;if(size.QuadPart){mapping=CreateFileMappingW(file,NULL,PAGE_READONLY,0,0,NULL);if(mapping)bytes=MapViewOfFile(mapping,FILE_MAP_READ,0,0,0);if(!bytes){if(mapping)CloseHandle(mapping);CloseHandle(file);return 2;}}
    result=VvEngineScan(bytes,(SIZE_T)size.QuadPart,&cancel);
    if(bytes)UnmapViewOfFile(bytes);if(mapping)CloseHandle(mapping);CloseHandle(file);
    puts(result==AvScanResultClean?"CLEAN":result==AvScanResultInfected?"DETECTED":"UNKNOWN");
    return result==AvScanResultClean?0:result==AvScanResultInfected?1:2;
}
