/* VirusVaccine additions, licensed under MS-PL; see ../LICENSE. */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#include <iphlpapi.h>
#include <stdio.h>
#include "clambridge.h"

static USHORT enginePort;
static DWORD enginePid;
static HANDLE engineProcess;
#define VV_MAX_STREAM (128u * 1024u * 1024u)

static BOOL OwnedListener(void) {
    DWORD size=0, status, i; PMIB_TCPTABLE_OWNER_PID table; BOOL found=FALSE;
    if (!engineProcess || WaitForSingleObject(engineProcess,0)!=WAIT_TIMEOUT) return FALSE;
    status=GetExtendedTcpTable(NULL,&size,FALSE,AF_INET,TCP_TABLE_OWNER_PID_LISTENER,0);
    if(status!=ERROR_INSUFFICIENT_BUFFER || size>1024*1024) return FALSE;
    table=(PMIB_TCPTABLE_OWNER_PID)HeapAlloc(GetProcessHeap(),0,size);
    if(!table) return FALSE;
    if(GetExtendedTcpTable(table,&size,FALSE,AF_INET,TCP_TABLE_OWNER_PID_LISTENER,0)==NO_ERROR)
        for(i=0;i<table->dwNumEntries;i++) {
            MIB_TCPROW_OWNER_PID *row=&table->table[i];
            if(row->dwLocalAddr==htonl(INADDR_LOOPBACK) && ntohs((USHORT)row->dwLocalPort)==enginePort && row->dwOwningPid==enginePid) found=TRUE;
        }
    HeapFree(GetProcessHeap(),0,table); return found;
}
BOOL VvEngineConfigure(USHORT port,DWORD processId) {
    WSADATA data;
    if(!port || !processId || WSAStartup(MAKEWORD(2,2),&data)) return FALSE;
    enginePort=port;enginePid=processId;
    engineProcess=OpenProcess(SYNCHRONIZE,FALSE,processId);
    return OwnedListener();
}
static BOOL SendAll(SOCKET socket,const char *data,int length,volatile BOOLEAN *cancel) {
    while(length>0) { int sent; if(cancel && *cancel) return FALSE;
        sent=send(socket,data,length,0);if(sent<=0)return FALSE;data+=sent;length-=sent;
    } return TRUE;
}
AVSCAN_RESULT VvEngineScan(const unsigned char *data,SIZE_T length,volatile BOOLEAN *cancel) {
    SOCKET connection=INVALID_SOCKET;struct sockaddr_in address={0};
    DWORD timeout=2000;SIZE_T offset=0;char response[4096]={0};int used=0;
    AVSCAN_RESULT result=AvScanResultUndetermined;ULONGLONG deadline=GetTickCount64()+20000;
    if(length>VV_MAX_STREAM || (length && !data) || (cancel && *cancel) || !OwnedListener())return result;
    connection=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);if(connection==INVALID_SOCKET)return result;
    setsockopt(connection,SOL_SOCKET,SO_SNDTIMEO,(char*)&timeout,sizeof(timeout));
    setsockopt(connection,SOL_SOCKET,SO_RCVTIMEO,(char*)&timeout,sizeof(timeout));
    address.sin_family=AF_INET;address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);address.sin_port=htons(enginePort);
    if(connect(connection,(struct sockaddr*)&address,sizeof(address)) || !OwnedListener())goto Done;
    if(!SendAll(connection,"zINSTREAM",10,cancel))goto Done;
    while(offset<length) {
        ULONG chunk=(ULONG)min(length-offset,65536), networkLength=htonl(chunk);
        if(GetTickCount64()>deadline || !SendAll(connection,(char*)&networkLength,4,cancel) || !SendAll(connection,(const char*)data+offset,(int)chunk,cancel))goto Done;
        offset+=chunk;
    }
    {ULONG end=0;if(!SendAll(connection,(char*)&end,4,cancel))goto Done;}
    while(used<(int)sizeof(response)-1 && GetTickCount64()<deadline) {
        int received;if(cancel && *cancel)goto Done;
        received=recv(connection,response+used,(int)sizeof(response)-1-used,0);
        if(received==SOCKET_ERROR && WSAGetLastError()==WSAETIMEDOUT)continue;
        if(received<=0)goto Done;used+=received;
        if(memchr(response,0,used))break;
    }
    if(used==0 || response[used-1]!=0)goto Done;
    if(!strcmp(response,"stream: OK"))result=AvScanResultClean;
    else {SIZE_T n=strlen(response);if(!strstr(response,"Heuristics.Limits.Exceeded") && !strncmp(response,"stream: ",8) && n>14 && !strcmp(response+n-6," FOUND"))result=AvScanResultInfected;}
Done:
    closesocket(connection);return result;
}
