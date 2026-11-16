import QueueMatrixLogo from '../../assets/QueueMatrix.png';

export default function LoginBranding() {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center justify-center w-25 h-25 rounded-2xl bg-blue-300 text-white shadow-lg shadow-blue-600/30 mb-1 overflow-hidden">
        <img
          src={QueueMatrixLogo}
          alt="Queue Matrix"
          className="w-23 h-23 rounded-2xl object-contain"
        />
      </div>

      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          QueueMatrix
        </h1>

        <p className="text-sm font-medium text-slate-500 mt-1">
          Portal Authentication Center
        </p>
      </div>
    </div>
  );
}