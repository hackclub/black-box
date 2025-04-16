namespace blackbox{
    extern "C" {
        #include "executor_private.h"
    }
}
namespace user {
    extern "C" {
        #include "user.h"
    }
}
void setup(){
    blackbox::executor_init();
    user::setup(); // call into user setup
}

void loop(){
    // todo: inputs, tick, etc.
}