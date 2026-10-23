import json
import sys

argv = sys.argv[1:]
if "--compat" in argv:
    i = argv.index("--compat")
    with open(argv[i + 1], encoding="utf-8") as fa, open(argv[i + 2], encoding="utf-8") as fb:
        print(json.dumps({"compat": [json.load(fa), json.load(fb)]}, ensure_ascii=False))
elif "--date" in argv and argv[argv.index("--date") + 1] == "1800-01-01":
    print(json.dumps({"error": "범위 밖"}, ensure_ascii=False))
    sys.exit(1)
else:
    print(json.dumps({"argv": argv}, ensure_ascii=False))
