package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var seen map[string]int

func findImages(path string, f os.FileInfo, err error) error {
	imageRe := regexp.MustCompile("images/.*$")
	seen[imageRe.FindString(path)] = 0
	return nil
}

func findUsage(path string, f os.FileInfo, err error) error {
	b, _ := ioutil.ReadFile(path)
	content := string(b)

	for path := range seen {
		if strings.Contains(content, path) {
			seen[path]++
		}
	}
	return nil
}

func main() {
	flag.Parse()
	images := flag.Arg(0)
	content := flag.Arg(1)
	seen = make(map[string]int)
	filepath.Walk(images, findImages)
	filepath.Walk(content, findUsage)
	for path, count := range seen {
		if count == 0 {
			fmt.Println(path)
		}
	}
}
