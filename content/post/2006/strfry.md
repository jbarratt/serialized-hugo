+++
date = "2006-03-19T13:37:00-07:00"
title = "strfry()"
slug = "strfry"
+++


I am not making this up.

```
    NAME
        strfry - randomize a string

    SYNOPSIS
        #include <string.h>

        char *strfry(char *string);

    DESCRIPTION
        The  strfry()  function  randomizes  the  contents  of  string by using
        rand(3) to randomly swap characters in the string.  The  result  is  an
        anagram of string.

    RETURN VALUE
        The strfry() functions returns a pointer to the randomized string.

    CONFORMING TO
        The  strfry()  function  is  unique  to  the  Linux C Library and GNU C
        Library.
```
