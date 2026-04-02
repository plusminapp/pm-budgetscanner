#!/bin/bash

echo "BudgetScanner.pdf opnieuw genereren starten"

pandoc BudgetScanner.md -o BudgetScanner.pdf \
  --pdf-engine=xelatex \
  -V lang=nl \
  -V mainfont='Trebuchet MS' \
  --include-in-header=./toc-naar-nieuwe-pagina.tex \
  --toc \
  --toc-depth=4 \
  -V geometry:margin=1in \
  -V 'geometry:left=3.5cm' \
  -V 'geometry:right=1.5cm' \
  -V 'geometry:top=1.5cm' \
  -V 'geometry:bottom=2cm' \
  --resource-path=.

echo "BudgetScanner.pdf opnieuw genereren afgerond"
