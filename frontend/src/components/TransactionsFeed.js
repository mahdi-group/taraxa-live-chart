import React from 'react';

const TransactionsFeed = ({ transactions }) => {
  if (!transactions || transactions.length === 0) {
    return <p>No transactions available.</p>;
  }

  return (
    <div>
      <h2>Live Transactions</h2>
      <ul>
        {transactions.map((tx, index) => (
          <li key={index}>
            {tx.type || 'Unknown Type'}: {tx.amount || 'N/A'} at {tx.timestamp || 'Unknown Time'}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TransactionsFeed;
