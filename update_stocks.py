import pandas as pd
import yfinance as yf
import json
from datetime import datetime, timedelta
import numpy as np

# File paths for the portfolios
portfolio_files = {
    "AIT": "./weight/AIT.csv",
    "ESS": "./weight/ESS.csv"
}

# Set investment amount
initial_investment = 10000

# Define the date range
end_date = datetime.today().date()
start_date_6m = end_date - timedelta(days=180)  # Approximate 6 months
start_date_1y = end_date - timedelta(days=365)

# Dictionary to store S&P 500 data separately
sp500_data_store = {}
nifty50_data_store = {}

def fetch_historical_prices(tickers, start, end):
    """Fetch stock prices from Yahoo Finance safely."""
    stock_data = yf.download(tickers, start=start, end=end)
    return stock_data["Adj Close"] if "Adj Close" in stock_data else stock_data.get("Close", pd.DataFrame())

def calculate_portfolio_performance(portfolio_name, file_path):
    df = pd.read_csv(file_path).rename(columns=lambda x: x.strip())
    # Replace spaces in ticker names with hyphens (if needed)
    df['name'] = df['name'].str.replace(" ", "-")
    tickers = df['name'].tolist()
    # Convert weights from percentages to decimals
    df['weight'] = df['weight'].astype(str).str.replace('%', '').astype(float) / 100
    original_weights = pd.Series(df['weight'].values, index=tickers)
    print(tickers)
    print(original_weights)
    portfolio_data = {}

    # Use only 6M and 1Y periods
    for period, start_date in {"6M": start_date_6m, "1Y": start_date_1y}.items():
        stock_data = fetch_historical_prices(tickers, start_date, end_date)
        sp500_data = fetch_historical_prices("^GSPC", start_date, end_date)
        nifty50_data = fetch_historical_prices("^NSEI", start_date, end_date)

        if stock_data.empty:
            raise ValueError(f"ERROR: Failed to fetch stock data for {portfolio_name} ({period}). Stopping execution.")
        if sp500_data.empty:
            raise ValueError(f"ERROR: Failed to fetch S&P 500 data for {period}. Stopping execution.")
        if nifty50_data.empty:
            raise ValueError(f"ERROR: Failed to fetch NIFTY 50 data for {period}. Stopping execution.")

        # Check if all tickers were successfully downloaded
        missing_tickers = [t for t in tickers if t not in stock_data.columns]
        if missing_tickers:
            raise ValueError(f"ERROR: Failed to download data for the following tickers in {portfolio_name} ({period}): {missing_tickers}. Please verify ticker symbols and try again. Stopping execution.")

        # Store S&P 500 and NIFTY 50 data separately (only once per period)
        if period not in sp500_data_store:
            sp500_performance = (sp500_data / sp500_data.iloc[0]) * initial_investment
            sp500_data_store[period] = {
                "dates": sp500_data.index.strftime('%Y-%m-%d').tolist(),
                "values": sp500_performance.iloc[:, 0].tolist()
            }
            nifty50_performance = (nifty50_data / nifty50_data.iloc[0]) * initial_investment
            nifty50_data_store[period] = {
                "dates": nifty50_data.index.strftime('%Y-%m-%d').tolist(),
                "values": nifty50_performance.iloc[:, 0].tolist()
            }

        # Portfolio calculations
        valid_tickers = [t for t in tickers if t in stock_data.columns]
        portfolio_weights = original_weights.loc[valid_tickers]

        initial_prices = stock_data.loc[stock_data.first_valid_index(), valid_tickers]
        shares_held = (portfolio_weights * initial_investment) / initial_prices
        portfolio_performance = (stock_data[valid_tickers] * shares_held).sum(axis=1)

        # --- Ratio Calculations ---
        portfolio_returns = portfolio_performance.pct_change().dropna()
        rf = 0  # Assume risk-free rate is 0 for simplicity

        # Sharpe Ratio (annualized, assuming 252 trading days)
        if portfolio_returns.std() != 0:
            sharpe_ratio = (portfolio_returns.mean() - rf) / portfolio_returns.std() * np.sqrt(252)
        else:
            sharpe_ratio = None

        # Sortino Ratio (annualized)
        downside_std = portfolio_returns[portfolio_returns < rf].std()
        if downside_std != 0:
            sortino_ratio = (portfolio_returns.mean() - rf) / downside_std * np.sqrt(252)
        else:
            sortino_ratio = None

        # Maximum Drawdown calculation
        cum_max = portfolio_performance.cummax()
        drawdown_series = (portfolio_performance - cum_max) / cum_max
        max_drawdown = drawdown_series.min()

        final_value = portfolio_performance.iloc[-1]
        total_return = ((final_value - initial_investment) / initial_investment) * 100
        print(f"{portfolio_name} ({period}) Total Return: {total_return:.2f}%")

        portfolio_data[period] = {
            "dates": portfolio_performance.index.strftime('%Y-%m-%d').tolist(),
            "values": portfolio_performance.values.tolist(),
            "ratios": {
                "Sharpe Ratio": sharpe_ratio,
                "Sortino Ratio": sortino_ratio,
                "Max Drawdown": max_drawdown,
                "Return": total_return
            }
        }

    # Save portfolio performance and ratio data to JSON file
    output_file = f"./weight/{portfolio_name}_Portfolio_Performance.json"
    with open(output_file, "w") as f:
        json.dump(portfolio_data, f, indent=4)

    print(f"Saved {portfolio_name} portfolio data to {output_file}")

# Calculate portfolio performance for AIT and ESS
for name, path in portfolio_files.items():
    calculate_portfolio_performance(name, path)

# Save S&P 500 performance data separately
sp500_output_file = "./weight/sp500_performance.json"
with open(sp500_output_file, "w") as f:
    json.dump(sp500_data_store, f, indent=4)
print(f"Saved S&P 500 performance data to {sp500_output_file}")

# Save NIFTY 50 performance data separately
nifty50_output_file = "./weight/nifty50_performance.json"
with open(nifty50_output_file, "w") as f:
    json.dump(nifty50_data_store, f, indent=4)
print(f"Saved NIFTY 50 performance data to {nifty50_output_file}")