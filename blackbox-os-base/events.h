/*
 * events.h: events ids (bitfields) for blackbox
 */
 
#ifndef EVENTS_H
#define EVENTS_H

#include <stdint.h>

typedef uint32_t event_mask;

// currently, this is just buttons

#define EVENT_PRESS_UP       0x1
#define EVENT_PRESS_DOWN     0x2
#define EVENT_PRESS_LEFT     0x4
#define EVENT_PRESS_RIGHT    0x8
#define EVENT_PRESS_SELECT   0x10
#define EVENT_RELEASE_UP     0x20
#define EVENT_RELEASE_DOWN   0x40
#define EVENT_RELEASE_LEFT   0x80
#define EVENT_RELEASE_RIGHT  0x100
#define EVENT_RELEASE_SELECT 0x200

#endif
