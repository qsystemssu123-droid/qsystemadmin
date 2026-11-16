export default function UsersHeader({ userCount }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          System User Accounts
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review user profiles, monitor system access, and manage user restrictions.
        </p>
      </div>

      <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded-xl text-xs font-semibold">
        Total Accounts: {userCount}
      </div>
    </div>
  );
}