#include<string.h>

void main(int argc, char **argv) {
  if (argv[1]) {
      printf("I can't believe it's not butter");
  }
  // But I want to believe it's not butter...
  memset(NULL, 1, 1);
}
