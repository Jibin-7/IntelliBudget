# forecasting_model.py — corrected CPT ordering
from pgmpy.models import DiscreteBayesianNetwork
from pgmpy.factors.discrete import TabularCPD
from pgmpy.inference import VariableElimination

def create_forecasting_model():
    model = DiscreteBayesianNetwork([
        ('SavingsSurplus', 'LikelihoodOfSuccess'),
        ('SpendingVolatility', 'LikelihoodOfSuccess')
    ])

    # 0=Negative,1=Sufficient,2=High
    cpd_surplus = TabularCPD(variable='SavingsSurplus', variable_card=3, values=[[0.3], [0.5], [0.2]])
    # 0=Low,1=High
    cpd_volatility = TabularCPD(variable='SpendingVolatility', variable_card=2, values=[[0.7], [0.3]])

    # Columns must be in cartesian order: (S=0,V=0), (S=0,V=1), (S=1,V=0), (S=1,V=1), (S=2,V=0), (S=2,V=1)
    cpd_success = TabularCPD(
        variable='LikelihoodOfSuccess', variable_card=3,
        values=[
            # Low
            [0.90, 0.99, 0.15, 0.40, 0.01, 0.10],
            # Medium
            [0.09, 0.01, 0.70, 0.50, 0.19, 0.30],
            # High
            [0.01, 0.00, 0.15, 0.10, 0.80, 0.60]
        ],
        evidence=['SavingsSurplus', 'SpendingVolatility'],
        evidence_card=[3, 2]
    )

    model.add_cpds(cpd_surplus, cpd_volatility, cpd_success)
    model.check_model()
    return model

def predict_success_likelihood(model, surplus_level, volatility_level):
    inference = VariableElimination(model)
    result = inference.query(
        variables=['LikelihoodOfSuccess'],
        evidence={'SavingsSurplus': surplus_level, 'SpendingVolatility': volatility_level}
    )
    probabilities = result.values  # numpy array
    prediction_index = int(probabilities.argmax())
    levels = ['Low', 'Medium', 'High']
    return {'level': levels[prediction_index], 'percentage': float(probabilities[prediction_index])}
