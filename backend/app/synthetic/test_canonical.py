from backend.app.synthetic.generators.canonical import (
    generate_canonical_data,
)

data = generate_canonical_data(
    num_territories=10,
    num_representatives=25,
    num_products=10,
    num_doctors=250,
)


for key, value in data.items():
    print(f"{key:20} {len(value):,}")


print()
print("Example anomaly:")

if data["anomalies"]:
    print(data["anomalies"][0])
