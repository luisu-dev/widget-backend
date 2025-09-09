import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

data = pd.read_csv("/datasets/flights_preprocessed.csv")

target = data["Arrival Delay"]
features = data.drop(["Arrival Delay"], axis=1)
features_train, features_valid, target_train, target_valid = train_test_split(
    features, target, test_size=0.25, random_state=12345
)

best_score=0
best_depth =0
for depth in range(1,16,1):
    model = RandomForestRegressor(n_estimators=20, max_depth=depth, random_state=12345)
    model.fit(features_train, target_train)
    score= model.score(features_valid,target_valid)
    if score > best_score:
        best_score= score
        best_depth=depth
    
    
model = RandomForestRegressor(n_estimators=60, max_depth=11, random_state=12345)
model.fit(features_train, target_train)

print("Configuración del modelo actual lograda:")
print("Valor R2 en un conjunto de entrenamiento", model.score(features_train, target_train))
print("Valor R2 en un conjunto de validación:", model.score(features_valid, target_valid))