#include "blackbox.h"
#include <stdint.h>
#include <stdio.h>

// Game of Life
// by @rivques

#define TICK_SPEED 500

uint8_t current_tick[8] = {
  0b11000000,
  0b11000000,
  0b00000000,
  0b00000000,
  0b00000000,
  0b00000010,
  0b00000110,
  0b00000101
};
uint8_t next_tick[8];

uint8_t get_cell_at_pos(uint8_t x, uint8_t y){
  if(x>7||y>7||x<0||y<0){
    // out of bounds
    // implement alternative boundaries here
    return 0;
  }
  //debug_print("Cell at %u, %u is %u", x, y, current_tick[y] & 1 << (7 - x));
  return ((current_tick[y] & 1 << (7 - x)) > 0 ? 1 : 0);
}

uint8_t get_alive_neighbor_count(uint8_t i){
  uint8_t alive = 0;
  uint8_t current_x = i % 8;
  uint8_t current_y = i / 8;

  // top row
  alive += get_cell_at_pos(current_x-1, current_y-1);
  alive += get_cell_at_pos(current_x, current_y-1);
  alive += get_cell_at_pos(current_x+1, current_y-1);
  // middle row
  alive += get_cell_at_pos(current_x-1, current_y);
  alive += get_cell_at_pos(current_x+1, current_y);
  // bottom row
  alive += get_cell_at_pos(current_x-1, current_y+1);
  alive += get_cell_at_pos(current_x, current_y+1);
  alive += get_cell_at_pos(current_x+1, current_y+1);

  //debug_print("Cell at %u, %u has %u alive neighbors", current_x, current_y, alive);
  return alive;
}

void make_alive(uint8_t i){
  next_tick[i/8] = next_tick[i/8] | 1 << 7 - (i % 8);
}

void make_dead(uint8_t i){
  next_tick[i/8] = next_tick[i/8] & ~(1 << 7 - (i % 8));
}

void gol_tick(task_handle self){
  debug_print("ticking!");
  // compute into next_tick
  for(uint8_t i = 0; i<64; i++){
    uint8_t neighbors = get_alive_neighbor_count(i);
    if(neighbors == 3){
      // born, so force the cell to be 1
      make_alive(i);
    } else if (neighbors == 2){
      // cell is the same as last tick
      // current_val is only the relevant bit, in the relevant pos
      uint8_t current_val = current_tick[i/8] & 1 << 7 - (i % 8);
      if(current_val > 0){
        make_alive(i);
      } else {
        make_dead(i);
      }
    } else {
      make_dead(i);
    }
  }
  // copy next_tick into current_tick and reset next_tick
  for(uint8_t i = 0; i<8; i++){
    current_tick[i] = next_tick[i];
    next_tick[i] = 0;
  }
  // display current_tick
  bb_matrix_set_arr(current_tick);
}

void setup(){
  bb_matrix_set_arr(current_tick);
  task_create_interval(gol_tick, TICK_SPEED);
}