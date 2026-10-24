#!/usr/bin/env python3
"""
Python entry point for judges.
Executes the Nexus agent runner via Node.js / tsx or launches the server.
Usage:
  python3 run.py input_examples/example_1.json
  python3 run.py --server
"""
import sys
import subprocess
import os

def main():
    args = sys.argv[1:]
    here = os.path.dirname(os.path.abspath(__file__))
    
    if "--server" in args:
        cmd = ["npx", "tsx", "src/server.ts"]
    else:
        cmd = ["npx", "tsx", "run.js"] + args

    result = subprocess.run(cmd, cwd=here)
    sys.exit(result.returncode)

if __name__ == "__main__":
    main()
