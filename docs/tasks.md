## Addendum: Task Internals

If you're really nerdy and curious about how actually tasks work, here's the full breakdown.

First, let's talk about the "operating system" that black box runs on. The source code (minus any platform-specific bits) can be found [here](https://github.com/Saghetti0/black-box-v2-editor/tree/main/blackbox-os-base).

![OS and source code diagram](https://hc-cdn.hel1.your-objectstorage.com/s/v3/71abd2ed64f91cce7c7318523fe12af8e678e3cf_image.png)

In order to allow easy porting between platforms (in our case, web and real hardware), the core source code makes very few assumptions about what it's running on. `plat_hal` provides some basic I/O, like writing to the screen and getting the current time, and `tick_loop` is designed to be called at the platform's discretion, doing the right thing even if there are large gaps in time.

The beating heart of this system is `tick_loop`. When called, it does the following things:
1. Figure out what tasks need to be activated by checking the current time and events
2. Pick a task from the top of the queue
3. Execute it
4. Handle deletions and re-queuing
5. Return to the caller when `tick_loop` should be invoked next for maximum efficiency.

TODO: finish writing (low priority)
