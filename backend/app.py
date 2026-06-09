from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
import calendar
from datetime import datetime, timedelta
from functools import wraps
from bson import ObjectId
import pandas as pd
from pymongo import MongoClient
from backend.pgm_model import create_risk_model, predict_risk
from forecasting_model import create_forecasting_model, predict_success_likelihood

# --- App & DB Initialization ---
app = Flask(__name__)
app.config['SECRET_KEY'] = 'miniproject'
MONGO_URI = 'mongodb+srv://jibinsjv_db_user:RGngmIAfGntE223J@intelli.5p7xhho.mongodb.net/?appName=Intelli'
client = MongoClient(MONGO_URI)
db = client.get_database('budget_planner_db')

# --- Utilities & Model Creation ---
CORS(app)
bcrypt = Bcrypt(app)
risk_model = create_risk_model()
forecasting_model = create_forecasting_model()

def get_user_date_range(db, current_user):
    oldest_cursor = db.transactions.find({'user_id': current_user['_id']}).sort("date", 1).limit(1)
    newest_cursor = db.transactions.find({'user_id': current_user['_id']}).sort("date", -1).limit(1)
    
    try:
        oldest_date_str = oldest_cursor[0]['date']
        newest_date_str = newest_cursor[0]['date']
        start_date = datetime.strptime(oldest_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(newest_date_str, '%Y-%m-%d')
        return start_date, end_date
    except (IndexError, KeyError):
        return None, None

# --- Helper Function to get user's full date range ---
def get_user_date_range(db, current_user):
    oldest_cursor = db.transactions.find({'user_id': current_user['_id']}).sort("date", 1).limit(1)
    newest_cursor = db.transactions.find({'user_id': current_user['_id']}).sort("date", -1).limit(1)
    
    try:
        oldest_date_str = oldest_cursor[0]['date']
        newest_date_str = newest_cursor[0]['date']
        start_date = datetime.strptime(oldest_date_str, '%Y-%m-%d')
        end_date = datetime.strptime(newest_date_str, '%Y-%m-%d')
        return start_date, end_date
    except (IndexError, KeyError):
        return None, None

# --- Token Decorator ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'x-access-token' in request.headers:
            token = request.headers['x-access-token']
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = db.users.find_one({'_id': ObjectId(data['user_id'])})
            if not current_user:
                 return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# --- Authentication & Basic Transaction Routes ---
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')
    user_id = db.users.insert_one({'email': data['email'], 'password': hashed_password}).inserted_id
    return jsonify({'message': 'New user created!', 'user_id': str(user_id)}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = db.users.find_one({'email': data['email']})
    if not user or not bcrypt.check_password_hash(user['password'], data['password']):
        return jsonify({'message': 'Could not verify'}), 401
    token = jwt.encode({'user_id': str(user['_id']), 'exp': datetime.utcnow() + timedelta(hours=24)}, app.config['SECRET_KEY'])
    return jsonify({'token': token})

@app.route('/api/transactions', methods=['POST'])
@token_required
def add_transaction(current_user):
    data = request.get_json()
    db.transactions.insert_one({'user_id': current_user['_id'], 'type': data['type'], 'category': data['category'], 'amount': float(data['amount']), 'date': data['date']})
    return jsonify({'message': 'Transaction added!'}), 201

@app.route('/api/transactions', methods=['GET'])
@token_required
def get_transactions(current_user):
    transactions = []
    for t in db.transactions.find({'user_id': current_user['_id']}).sort('date', -1):
        t['_id'] = str(t['_id'])
        t['user_id'] = str(t['user_id'])
        transactions.append(t)
    return jsonify(transactions)

@app.route('/api/transactions/<id>', methods=['DELETE'])
@token_required
def delete_transaction(current_user, id):
    try:
        transaction_to_delete = db.transactions.find_one({'_id': ObjectId(id), 'user_id': current_user['_id']})
        if not transaction_to_delete:
            return jsonify({'message': 'Transaction not found or you do not have permission.'}), 404
        db.transactions.delete_one({'_id': ObjectId(id)})
        return jsonify({'message': 'Transaction deleted!'}), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/api/transactions/<id>', methods=['PUT'])
@token_required
def update_transaction(current_user, id):
    try:
        transaction_to_update = db.transactions.find_one({'_id': ObjectId(id), 'user_id': current_user['_id']})
        if not transaction_to_update:
            return jsonify({'message': 'Transaction not found or you do not have permission.'}), 404
        data = request.get_json()
        update_payload = {'type': data['type'], 'category': data['category'], 'amount': float(data['amount']), 'date': data['date']}
        db.transactions.update_one({'_id': ObjectId(id)}, {'$set': update_payload})
        return jsonify({'message': 'Transaction updated!'}), 200
    except Exception as e:
        return jsonify({'message': str(e)}), 500

# --- UPDATED SUMMARY & ANALYSIS ROUTES ---

@app.route('/api/summary', methods=['GET'])
@token_required
def get_summary(current_user):
    pipeline = [{'$match': {'user_id': current_user['_id'], 'type': 'expense'}}, {'$group': {'_id': '$category', 'total': {'$sum': '$amount'}}}]
    expenses_by_category = list(db.transactions.aggregate(pipeline))
    total_income = sum(t['amount'] for t in db.transactions.find({'user_id': current_user['_id'], 'type': 'income'}))
    total_expense = sum(t['amount'] for t in db.transactions.find({'user_id': current_user['_id'], 'type': 'expense'}))
    return jsonify({'total_income': total_income, 'total_expense': total_expense, 'balance': total_income - total_expense, 'expenses_by_category': expenses_by_category})

@app.route('/api/analysis', methods=['GET'])
@token_required
def get_analysis(current_user):
    transactions = list(db.transactions.find({'user_id': current_user['_id']}))
    start_date, end_date = get_user_date_range(db, current_user)

    if not transactions or not start_date:
        empty_data = {'labels': [], 'data': []}
        return jsonify({
            'daily': {'income': empty_data, 'expense': empty_data},
            'weekly': {'income': empty_data, 'expense': empty_data},
            'monthly': {'income': empty_data, 'expense': empty_data}
        })

    df = pd.DataFrame(transactions)
    df['date'] = pd.to_datetime(df['date'])
    df.set_index('date', inplace=True)
    
    income_df = df[df['type'] == 'income']['amount']
    expense_df = df[df['type'] == 'expense']['amount']

    # This is the robust helper function that fixes the bug
    def format_resample_data(series, rule, date_index, strf_format):
        # Resample the data first to group it
        resampled = series.resample(rule).sum()
        # THEN, align it to the master timeline, filling all gaps with 0
        resampled = resampled.reindex(date_index, fill_value=0)
        return {
            'labels': resampled.index.strftime(strf_format).tolist(),
            'data': resampled.values.tolist()
        }

    # Create the master timelines for the user's entire history
    daily_index = pd.date_range(start=start_date, end=end_date, freq='D')
    weekly_index = pd.date_range(start=start_date, end=end_date, freq='W-MON')
    monthly_index = pd.date_range(start=start_date, end=end_date, freq='ME')

    analysis_data = {
        'daily': {'income': format_resample_data(income_df, 'D', daily_index, '%b %d'), 'expense': format_resample_data(expense_df, 'D', daily_index, '%b %d')},
        'weekly': {'income': format_resample_data(income_df, 'W-MON', weekly_index, 'Week of %b %d'), 'expense': format_resample_data(expense_df, 'W-MON', weekly_index, 'Week of %b %d')},
        'monthly': {'income': format_resample_data(income_df, 'ME', monthly_index, '%B %Y'), 'expense': format_resample_data(expense_df, 'ME', monthly_index, '%B %Y')},
    }
    return jsonify(analysis_data)

@app.route('/api/trends', methods=['GET'])
@token_required
def get_trends(current_user):
    timeframe_rule = request.args.get('timeframe_rule', 'ME').upper()
    start_date, end_date = get_user_date_range(db, current_user)
    if not start_date:
        return jsonify({'labels': [], 'datasets': []})

    transactions = list(db.transactions.find({'user_id': current_user['_id'], 'type': 'expense'}))
    if not transactions:
        return jsonify({'labels': [], 'datasets': []})
        
    df = pd.DataFrame(transactions)
    df['date'] = pd.to_datetime(df['date'])
    
    pivot = pd.pivot_table(df, values='amount', index='date', columns='category', aggfunc='sum').fillna(0)
    resampled_pivot = pivot.resample(timeframe_rule).sum()

    # --- THIS IS THE FIX ---
    # Determine the correct date format based on the timeframe
    if timeframe_rule == 'D':
        strf_format = '%b %d'
    elif timeframe_rule == 'W-MON':
        strf_format = 'Week of %b %d'
    else: # 'ME' for Monthly
        strf_format = '%B %Y' # This will produce "August 2025"

    colors = ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(99, 255, 132, 0.7)']
    
    resampled_pivot = resampled_pivot.loc[:, (resampled_pivot != 0).any(axis=0)]
    top_categories = resampled_pivot.sum().sort_values(ascending=False).head(len(colors)).index.tolist()
    resampled_pivot = resampled_pivot[top_categories]

    datasets = []
    for i, category in enumerate(resampled_pivot.columns):
        datasets.append({'label': category, 'data': resampled_pivot[category].values.tolist(), 'backgroundColor': colors[i % len(colors)]})

    # Use the new dynamic format for the labels
    chart_data = {'labels': resampled_pivot.index.strftime(strf_format).tolist(), 'datasets': datasets}
    
    return jsonify(chart_data)

@app.route('/api/categorical_summary', methods=['GET'])
@token_required
def get_categorical_summary(current_user):
    pipeline = [{'$match': {'user_id': current_user['_id'], 'type': 'expense'}}, {'$group': {'_id': '$category', 'total': {'$sum': '$amount'}}}, {'$sort': {'total': -1}}]
    summary = list(db.transactions.aggregate(pipeline))
    return jsonify(summary)

@app.route('/api/insights', methods=['GET'])
@token_required
def get_insights(current_user):
    try:
        timeframe = request.args.get('timeframe', 'monthly')
        
        transactions = list(db.transactions.find({'user_id': current_user['_id']}))
        if not transactions:
            return jsonify({"summary": "Add transactions to generate insights.", "peak_period": "", "trend": ""})

        df = pd.DataFrame(transactions)
        df['date'] = pd.to_datetime(df['date'])
        df.set_index('date', inplace=True)
        
        # Determine the resampling rule and labels
        if timeframe == 'daily': rule, strf, period_word = 'D', '%b %d', 'day'
        elif timeframe == 'weekly': rule, strf, period_word = 'W-MON', 'Week of %b %d', 'week'
        else: rule, strf, period_word = 'ME', '%B %Y', 'month'

        # --- THIS IS THE FIX: A more robust way to calculate totals ---
        
        # 1. Resample income and expense series separately
        resampled_income_series = df[df['type'] == 'income']['amount'].resample(rule).sum()
        resampled_expense_series = df[df['type'] == 'expense']['amount'].resample(rule).sum()

        # 2. Combine them into a single DataFrame to create a unified timeline, filling gaps with 0
        combined_df = pd.DataFrame({
            'income': resampled_income_series,
            'expense': resampled_expense_series
        }).fillna(0)

        # 3. All subsequent calculations are now based on this clean, combined data
        total_income = combined_df['income'].sum()
        total_expense = combined_df['expense'].sum()
        net_value = total_income - total_expense

        # Insight 1: Overall Summary
        summary_insight = "In this period, you had no activity."
        if total_income > 0 or total_expense > 0:
            savings_rate = (net_value / total_income) * 100 if total_income > 0 else -100
            if net_value >= 0:
                summary_insight = f"Overall, you've saved ₹{net_value:,.2f} ({savings_rate:.0f}% of your income)."
            else:
                summary_insight = f"Overall, you've had a net loss of ₹{-net_value:,.2f}."
        
        # Insight 2: Average Spending
        active_periods = combined_df['expense'][combined_df['expense'] > 0]
        average_spending = active_periods.mean() if not active_periods.empty else 0
        average_insight = f"On average, you spend ₹{average_spending:,.2f} per {period_word} with expenses."

        # Insight 3: Peak Spending Period
        peak_insight = ""
        if total_expense > 0:
            peak_period_date = combined_df['expense'].idxmax()
            peak_amount = combined_df['expense'].max()
            peak_insight = f"Your highest spending {period_word} was {peak_period_date.strftime(strf)}, where you spent ₹{peak_amount:,.2f}."

        # Insight 4: Trend Analysis
        trend_insight = ""
        if len(combined_df['expense']) >= 4:
            midpoint = len(combined_df['expense']) // 2
            first_half_total = combined_df['expense'][:midpoint].sum()
            second_half_total = combined_df['expense'][midpoint:].sum()
            if second_half_total > first_half_total * 1.2:
                trend_insight = "Your spending trended upwards in the latter half of the period."
            elif first_half_total > second_half_total * 1.2:
                trend_insight = "Good job! Your spending trended downwards in the latter half of the period."
            
        return jsonify({
            "summary": summary_insight,
            "average_spending": average_insight,
            "peak_period": peak_insight,
            "trend": trend_insight
        })
    except Exception as e:
        print(f"CRITICAL ERROR in /api/insights: {e}")
        return jsonify({'message': 'An error occurred while generating insights.'}), 500


def calculate_risk_score(income, expense):
    # Handle edge cases first
    if income <= 0:
        return 100 if expense > 0 else 0

    # --- NEW DYNAMIC FORMULA ---
    # The risk score is calculated directly from the spending ratio.
    # We use a power (expense / income)^1.5 to make the risk increase
    # more sharply as spending gets higher.
    
    spending_ratio = expense / income
    
    # Ensure ratio doesn't go below 0 (e.g., from a refund)
    spending_ratio = max(0, spending_ratio) 
    
    # Calculate score. The score is capped at 100.
    risk_score = min(100, (spending_ratio ** 1.5) * 100)
    
    return int(risk_score)

# --- PGM Risk Prediction Route ---
@app.route('/api/risk', methods=['GET'])
@token_required
def get_risk_prediction(current_user):
    total_income = sum(t['amount'] for t in db.transactions.find({'user_id': current_user['_id'], 'type': 'income'}))
    total_expense = sum(t['amount'] for t in db.transactions.find({'user_id': current_user['_id'], 'type': 'expense'}))

    # Calculate the logical risk score using the new, stricter helper function
    risk_score = calculate_risk_score(total_income, total_expense)

    # Discretize the score for the PGM using the user-defined thresholds
    if risk_score < 40: score_category = 0      # Low
    elif risk_score < 75: score_category = 1 # Medium
    elif risk_score < 100: score_category = 2  # High
    else: score_category = 3                     # Extreme
    
    predicted_level = predict_risk(risk_model, score_category)
    
    recommendation = ""
    spending_ratio = (total_expense / total_income) if total_income > 0 else 1.0

    if predicted_level == 'Extreme':
        recommendation = "Your spending has exceeded your income. This is an extreme risk situation requiring immediate action."
    elif predicted_level == 'High':
        recommendation = f"You're spending {spending_ratio:.0%} of your income, leaving a very small savings buffer. This is a high-risk situation."
    elif predicted_level == 'Medium':
        recommendation = f"You're spending {spending_ratio:.0%} of your income. Watch out for non-essential expenses to improve your savings."
    else: # Low risk
        recommendation = "Great job keeping your spending in check!"
    
    if predicted_level in ['Medium', 'High', 'Extreme']:
        pipeline = [{'$match': {'user_id': current_user['_id'], 'type': 'expense'}}, {'$group': {'_id': '$category', 'total': {'$sum': '$amount'}}}, {'$sort': {'total': -1}}, {'$limit': 1}]
        top_category = list(db.transactions.aggregate(pipeline))
        if top_category:
            recommendation += f" Your top spending category is '{top_category[0]['_id']}'."

    return jsonify({
        'level': predicted_level,
        'percentage': risk_score,
        'recommendation': recommendation
    })

# --- Savings Goal Routes ---
@app.route('/api/goals', methods=['POST'])
@token_required
def add_goal(current_user):
    data = request.get_json()
    db.goals.insert_one({'user_id': current_user['_id'], 'name': data['name'], 'goal_amount': float(data['goal_amount']), 'target_date': data['target_date']})
    return jsonify({'message': 'Goal added successfully!'}), 201

@app.route('/api/goals', methods=['GET'])
@token_required
def get_goals(current_user):
    try:
        goals = []

        # --- Use a more stable recent window (180 days). Fallback to all data if empty. ---
        days_window = 180
        window_start = datetime.utcnow() - timedelta(days=days_window)
        recent_transactions = list(db.transactions.find({
            'user_id': current_user['_id'],
            'date': {'$gte': window_start.strftime('%Y-%m-%d')}
        }))

        # Fallback to full history if window returned nothing
        if not recent_transactions:
            recent_transactions = list(db.transactions.find({'user_id': current_user['_id']}))

        # If still empty, return goals with "no data" hints
        if not recent_transactions:
            for goal in db.goals.find({'user_id': current_user['_id']}):
                goal['_id'] = str(goal['_id'])
                goal['user_id'] = str(goal['user_id'])
                goal['advice'] = "Add income/expense entries to get a success prediction."
                goal['likelihood'] = {'level': 'Unknown', 'percentage': 0}
                goal['required_monthly_savings'] = None
                goal['current_monthly_savings'] = 0
                goal['months_remaining'] = None
                goals.append(goal)
            return jsonify(goals)

        # Build DataFrame and normalize
        df = pd.DataFrame(recent_transactions)

        # Ensure a date column is present and parsed
        if 'date' in df.columns:
            df['date'] = pd.to_datetime(df['date'])
        else:
            df['date'] = pd.to_datetime(df.get('created_at', pd.Series([datetime.utcnow()] * len(df))))

        # Normalize type column values to lowercase for consistent filtering
        if 'type' in df.columns:
            df['type'] = df['type'].astype(str).str.lower()
        else:
            df['type'] = ''

        # compute sums over the observed window
        total_income = df[df['type'] == 'income']['amount'].sum()
        total_expense = df[df['type'] == 'expense']['amount'].sum()

        # compute observed months to derive monthly average robustly
        observed_days = max(1, (df['date'].max() - df['date'].min()).days)
        observed_months = max(1.0, observed_days / 30.44)
        current_monthly_savings = (total_income - total_expense) / observed_months

        # volatility: resample monthly and check std vs mean
        try:
            monthly_expenses = df[df['type'] == 'expense'].set_index('date')['amount'].resample('ME').sum()
            volatility_level = 1 if (not monthly_expenses.empty and monthly_expenses.std() > (monthly_expenses.mean() * 0.5)) else 0
        except Exception:
            volatility_level = 0

        # Loop through goals and compute required/current/likelihood/advice
        for goal in db.goals.find({'user_id': current_user['_id']}):
            goal['_id'] = str(goal['_id'])
            goal['user_id'] = str(goal['user_id'])

            target_date_str = goal.get('target_date')
            goal_amount = float(goal.get('goal_amount', 0) or 0)

            # defaults (used if we can't compute)
            goal['required_monthly_savings'] = None
            goal['current_monthly_savings'] = current_monthly_savings
            goal['likelihood'] = {'level': 'Unknown', 'percentage': 0.0}
            goal['advice'] = "Unable to compute — check transactions / target date."
            goal['months_remaining'] = None

            if not target_date_str:
                goal['advice'] = "No target date set."
                goals.append(goal)
                continue

            # robustly parse target date
            try:
                target_date = datetime.strptime(target_date_str, '%Y-%m-%d')
            except Exception:
                goal['advice'] = "Invalid target date format."
                goals.append(goal)
                continue

            days_remaining = (target_date - datetime.utcnow()).days

            if days_remaining <= 0:
                # target date passed or today -> don't force an extreme required rate
                goal['required_monthly_savings'] = None
                goal['likelihood'] = {'level': 'Unknown', 'percentage': 0.0}
                goal['advice'] = "Target date has passed. Please update the target date."
                goal['months_remaining'] = 0.0
                goals.append(goal)
                continue

            # compute months remaining (fractional)
            months_remaining = days_remaining / 30.44
            required_monthly_savings = goal_amount / months_remaining if months_remaining > 0 else float('inf')

            # surplus and classification (stricter thresholds)
            surplus = current_monthly_savings - required_monthly_savings

            if required_monthly_savings == 0:
                surplus_level = 2  # goal already satisfied
            else:
                if surplus < -0.2 * required_monthly_savings:
                    surplus_level = 0
                elif surplus < 0.2 * required_monthly_savings:
                    surplus_level = 1
                else:
                    surplus_level = 2

            likelihood = predict_success_likelihood(forecasting_model, surplus_level, volatility_level)

            if surplus_level == 0:
                shortfall = abs(surplus)
                advice = f"This goal is at risk. You need to save about ₹{shortfall:,.0f} more per month."
            elif surplus_level == 1:
                advice = "You're on track, but have a small buffer. Consistent saving is key."
            else:
                advice = "You are comfortably on track to achieve this goal!"

            # Save computed values (including months_remaining)
            goal['required_monthly_savings'] = required_monthly_savings
            goal['current_monthly_savings'] = current_monthly_savings
            goal['likelihood'] = likelihood
            goal['advice'] = advice
            goal['months_remaining'] = months_remaining

            goals.append(goal)

        return jsonify(goals)
    except Exception as e:
        print(f"CRITICAL ERROR in /api/goals: {e}")
        return jsonify({'message': 'An internal error occurred while fetching goals.'}), 500

@app.route('/api/goals/<id>', methods=['DELETE'])
@token_required
def delete_goal(current_user, id):
    db.goals.delete_one({'_id': ObjectId(id), 'user_id': current_user['_id']})
    return jsonify({'message': 'Goal deleted successfully!'}), 200

# --- Group & Bill Splitting Routes ---
@app.route('/api/groups', methods=['POST'])
@token_required
def create_group(current_user):
    data = request.get_json()
    group_id = db.groups.insert_one({'name': data['name'], 'created_by': current_user['_id'], 'members': [current_user['_id']]}).inserted_id
    return jsonify({'message': 'Group created!', 'group_id': str(group_id)}), 201

@app.route('/api/groups', methods=['GET'])
@token_required
def get_groups(current_user):
    groups = []
    for group in db.groups.find({'members': current_user['_id']}):
        group['_id'] = str(group['_id'])
        group['created_by'] = str(group['created_by'])
        group['members'] = [str(member_id) for member_id in group.get('members', [])]
        groups.append(group)
    return jsonify(groups)

@app.route('/api/groups/<group_id>/members', methods=['POST'])
@token_required
def invite_member(current_user, group_id):
    data = request.get_json()
    user_to_invite = db.users.find_one({'email': data['email']})
    if not user_to_invite:
        return jsonify({'message': 'User with that email not found.'}), 404
    db.groups.update_one({'_id': ObjectId(group_id)}, {'$addToSet': {'members': user_to_invite['_id']}})
    return jsonify({'message': f"{data['email']} has been added to the group!"}), 200

@app.route('/api/groups/<group_id>/expenses', methods=['POST'])
@token_required
def add_group_expense(current_user, group_id):
    data = request.get_json()
    group = db.groups.find_one({'_id': ObjectId(group_id)})
    if not group: return jsonify({'message': 'Group not found'}), 404
    db.group_expenses.insert_one({'group_id': ObjectId(group_id), 'description': data['description'], 'amount': float(data['amount']), 'paid_by_user_id': current_user['_id'], 'participants': group.get('members', [])})
    return jsonify({'message': 'Expense added to group!'}), 201

@app.route('/api/groups/<group_id>', methods=['GET'])
@token_required
def get_group_details(current_user, group_id):
    try:
        group = db.groups.find_one({'_id': ObjectId(group_id)})
        if not group: return jsonify({'message': 'Group not found'}), 404
        
        expenses = list(db.group_expenses.find({'group_id': ObjectId(group_id)}))
        group_members = [str(m) for m in group.get('members', [])]
        balances = {member_id: 0.0 for member_id in group_members}
        
        for expense in expenses:
            participants = [str(p) for p in expense.get('participants', group_members)]
            num_participants = len(participants)
            if num_participants == 0: continue
            share = expense.get('amount', 0) / num_participants
            payer_id = str(expense.get('paid_by_user_id'))
            if payer_id in balances: balances[payer_id] += expense.get('amount', 0)
            for participant_id in participants:
                if participant_id in balances: balances[participant_id] -= share
        
        debtors = {uid: bal for uid, bal in balances.items() if bal < -0.01}
        creditors = {uid: bal for uid, bal in balances.items() if bal > 0.01}
        simplified_debts = []
        sorted_debtors = sorted(debtors.items(), key=lambda item: item[1])
        sorted_creditors = sorted(creditors.items(), key=lambda item: item[1], reverse=True)
        debtor_idx, creditor_idx = 0, 0
        while debtor_idx < len(sorted_debtors) and creditor_idx < len(sorted_creditors):
            debtor_id, debtor_bal = sorted_debtors[debtor_idx]
            creditor_id, creditor_bal = sorted_creditors[creditor_idx]
            transfer_amount = min(abs(debtor_bal), creditor_bal)
            simplified_debts.append({'from': debtor_id, 'to': creditor_id, 'amount': transfer_amount})
            sorted_debtors[debtor_idx] = (debtor_id, debtor_bal + transfer_amount)
            sorted_creditors[creditor_idx] = (creditor_id, creditor_bal - transfer_amount)
            if abs(sorted_debtors[debtor_idx][1]) < 0.01: debtor_idx += 1
            if abs(sorted_creditors[creditor_idx][1]) < 0.01: creditor_idx += 1

        member_ids_obj = group.get('members', [])
        members_details = list(db.users.find({'_id': {'$in': member_ids_obj}}, {'_id': 1, 'email': 1}))
        for member in members_details: member['_id'] = str(member['_id'])
        
        group['_id'] = str(group['_id'])
        group['created_by'] = str(group.get('created_by'))
        group['members'] = [str(m) for m in group.get('members', [])]
        
        for exp in expenses: 
            exp['_id'] = str(exp['_id'])
            exp['group_id'] = str(exp['group_id'])
            exp['paid_by_user_id'] = str(exp['paid_by_user_id'])
            exp['participants'] = [str(p) for p in exp.get('participants', [])]
            
        return jsonify({'group': group, 'expenses': expenses, 'balances': balances, 'members_details': members_details, 'simplified_debts': simplified_debts})
    except Exception as e:
        print(f"CRITICAL ERROR in /api/groups/{group_id}: {e}")
        return jsonify({'message': 'An internal error occurred while fetching group details.'}), 500

@app.route('/api/groups/<group_id>', methods=['PUT'])
@token_required
def update_group(current_user, group_id):
    try:
        group = db.groups.find_one({'_id': ObjectId(group_id)})
        # Security check: Only the creator can edit the group
        if not group or group['created_by'] != current_user['_id']:
            return jsonify({'message': 'Permission denied'}), 403
            
        data = request.get_json()
        new_name = data.get('name')
        if not new_name:
            return jsonify({'message': 'New name is required'}), 400

        db.groups.update_one(
            {'_id': ObjectId(group_id)},
            {'$set': {'name': new_name}}
        )
        return jsonify({'message': 'Group name updated successfully!'}), 200
    except Exception as e:
        print(f"ERROR in update_group: {e}")
        return jsonify({'message': 'Internal server error'}), 500


@app.route('/api/groups/<group_id>', methods=['DELETE'])
@token_required
def delete_group(current_user, group_id):
    try:
        group = db.groups.find_one({'_id': ObjectId(group_id)})
        # Security check: Only the creator can delete the group
        if not group or group['created_by'] != current_user['_id']:
            return jsonify({'message': 'Permission denied'}), 403

        # First, delete all expenses associated with this group
        db.group_expenses.delete_many({'group_id': ObjectId(group_id)})
        
        # Then, delete the group itself
        db.groups.delete_one({'_id': ObjectId(group_id)})
        
        return jsonify({'message': 'Group and all its expenses deleted successfully!'}), 200
    except Exception as e:
        print(f"ERROR in delete_group: {e}")
        return jsonify({'message': 'Internal server error'}), 500

# --- ANOMALY DETECTION ROUTE ---
@app.route('/api/check-anomaly', methods=['POST'])
@token_required
def check_anomaly(current_user):
    new_transaction = request.get_json() # e.g., {'amount': 5000, 'category': 'Shopping'}
    
    # Fetch user's historical expense data
    historical_expenses = list(db.transactions.find(
        {'user_id': current_user['_id'], 'type': 'expense'},
        {'amount': 1, 'category': 1, '_id': 0} # Fetch only needed fields
    ))
    
    if len(historical_expenses) < 10: # Need enough data to make a prediction
        return jsonify({'is_anomaly': False, 'message': 'Not enough data for anomaly detection.'})

    df = pd.DataFrame(historical_expenses)
    df.rename(columns={'category': 'Category'}, inplace=True)

    # --- A Simple Anomaly Labeling for Training ---
    # Label the top 5% of expenses in each category as an anomaly for our model to learn from
    df['IsAnomaly'] = df.groupby('Category')['amount'].transform(lambda x: x > x.quantile(0.95)).astype(int)

    # Create and "train" the model on the fly
    user_model = create_anomaly_model(df)
    
    # Predict if the new transaction is an anomaly
    is_anomaly = predict_anomaly(user_model, new_transaction, df)
    
    message = ""
    if is_anomaly:
        # Find the user's average for that category
        avg_spend = df[df['Category'] == new_transaction['category']]['amount'].mean()
        message = f"This is an unusually high expense for '{new_transaction['category']}'. Your average is around ₹{avg_spend:,.2f}."

    return jsonify({'is_anomaly': is_anomaly, 'message': message})

# --- Main Execution Block ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)