import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import {
  CircleDollarSign,
  ClipboardList,
  Table2,
  TrendingUp,
  ChefHat,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, Loading } from "../components/UI";
export default function Dashboard() {
  const { user, activeBranchId } = useAuth();
  const branch = `?branch_id=${activeBranchId}`;
  const { data, loading, error, reload } = useApi(`/dashboard${branch}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = data?.today || {};
  return (
    <>
      <div className="welcome">
        <div>
          <h2>សួស្តី, {user.full_name} 👋</h2>
          <p>សង្ខេបប្រតិបត្តិការភោជនីយដ្ឋានថ្ងៃនេះ</p>
        </div>
        <Link className="btn" to="/pos">
          បើក POS <ArrowRight />
        </Link>
      </div>
      <div className="stats">
        <Stat
          icon={CircleDollarSign}
          label="លក់សរុប"
          value={`$${Number(d.sales || 0).toFixed(2)}`}
          color="green"
        />
        <Stat
          icon={ClipboardList}
          label="ចំនួនវិក្កយបត្រ"
          value={d.orders || 0}
          color="blue"
        />
        <Stat
          icon={TrendingUp}
          label="លទ្ធផលប្រតិបត្តិការ"
          value={`$${Number(d.net_operating_result || 0).toFixed(2)}`}
          color="purple"
        />
        <Stat
          icon={Table2}
          label="តុកំពុងប្រើ"
          value={`${data?.tables?.occupied || 0}/${data?.tables?.total || 0}`}
          color="orange"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <h3>ចូលប្រើរហ័ស</h3>
          <div className="quick">
            <Link to="/pos">
              <CircleDollarSign />
              POS លក់
            </Link>
            <Link to="/tables">
              <Table2 />
              តុអាហារ
            </Link>
            <Link to="/kitchen">
              <ChefHat />
              ផ្ទះបាយ
            </Link>
            <Link to="/inventory">
              <ClipboardList />
              ស្តុក
            </Link>
          </div>
        </section>
        <section className="panel">
          <h3>ចំណាយថ្ងៃនេះ</h3>
          <div className="big-number">
            ${Number(d.expenses || 0).toFixed(2)}
          </div>
          <p>លទ្ធផល = ការលក់ − ចំណាយ</p>
        </section>
      </div>
    </>
  );
}
function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="stat">
      <span className={color}>
        <Icon />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
