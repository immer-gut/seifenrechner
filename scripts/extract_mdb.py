import argparse
import csv
import json
import os
from pathlib import Path

import jaydebeapi


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mdb", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--jars", required=True)
    args = parser.parse_args()

    mdb = Path(args.mdb).resolve()
    out = Path(args.out).resolve()
    jar_dir = Path(args.jars).resolve()
    jars = [str(path) for path in jar_dir.glob("*.jar")]

    out.mkdir(parents=True, exist_ok=True)

    conn = jaydebeapi.connect(
        "net.ucanaccess.jdbc.UcanaccessDriver",
        f"jdbc:ucanaccess://{mdb};memory=false",
        [],
        jars,
    )

    try:
        tables = list_tables(conn)
        (out / "tables.json").write_text(json.dumps(tables, indent=2, ensure_ascii=False), encoding="utf-8")

        summary = []
        for table in tables:
            rows, columns = read_table(conn, table)
            summary.append({"table": table, "rows": len(rows), "columns": columns})
            write_csv(out / f"{safe_name(table)}.csv", columns, rows)
            (out / f"{safe_name(table)}.json").write_text(
                json.dumps([dict(zip(columns, row)) for row in rows], indent=2, ensure_ascii=False, default=str),
                encoding="utf-8",
            )

        (out / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    finally:
        conn.close()


def list_tables(conn):
    metadata = conn.jconn.getMetaData()
    result = metadata.getTables(None, None, "%", ["TABLE"])
    tables = []
    while result.next():
        name = str(result.getString("TABLE_NAME"))
        if not name.startswith("MSys"):
            tables.append(name)
    result.close()
    return sorted(tables)


def read_table(conn, table):
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM [{table}]")
        columns = [item[0] for item in cursor.description]
        rows = cursor.fetchall()
        return rows, columns
    finally:
        cursor.close()


def write_csv(path, columns, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        writer.writerows(rows)


def safe_name(name):
    return "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)


if __name__ == "__main__":
    main()

