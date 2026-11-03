/* VirusVaccine additions, licensed under MS-PL; see ../LICENSE. */
#pragma once
#include <windows.h>
#include "avlib.h"
BOOL VvEngineConfigure(USHORT port, DWORD processId);
AVSCAN_RESULT VvEngineScan(const unsigned char *data, SIZE_T length, volatile BOOLEAN *cancel);
