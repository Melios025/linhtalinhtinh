import json
import unicodedata
import re

def normalize_text(s):
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'[《》「」『』""\'\'?？!！]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip().lower()

# Đọc 2 file JSON
with open("output.json", "r", encoding="utf-8") as f:
    data1 = json.load(f)

with open("vandap.json", "r", encoding="utf-8") as f:
    data2 = json.load(f)

# Normalize keys
norm1 = {normalize_text(k): {"original_key": k, "value": v} for k, v in data1.items()}
norm2 = {normalize_text(k): {"original_key": k, "value": v} for k, v in data2.items()}

# Bắt đầu từ file2
merged = dict(data2)

count_added = 0
count_updated = 0

for norm_key, item1 in norm1.items():
    if norm_key not in norm2:
        # Key không có trong file2 → thêm vào
        merged[item1["original_key"]] = item1["value"]
        print(f"[THÊM] {item1['original_key']}: {item1['value']}")
        count_added += 1
    else:
        # Key có trong cả 2 nhưng value khác → dùng value của file1
        if normalize_text(item1["value"]) != normalize_text(norm2[norm_key]["value"]):
            original_key2 = norm2[norm_key]["original_key"]
            merged[original_key2] = item1["value"]
            print(f"[CẬP NHẬT] {original_key2}")
            print(f"  file2 cũ: {norm2[norm_key]['value']}")
            print(f"  file1 mới: {item1['value']}")
            count_updated += 1

# Ghi ra file mới
with open("merged.json", "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"\n=== Tổng kết ===")
print(f"  file1: {len(data1)} keys")
print(f"  file2: {len(data2)} keys")
print(f"  Đã thêm: {count_added} keys")
print(f"  Đã cập nhật: {count_updated} keys")
print(f"  merged.json: {len(merged)} keys")