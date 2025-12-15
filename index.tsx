import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  ShoppingBag, 
  Menu as MenuIcon, 
  X, 
  ChefHat, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  Clock, 
  Truck, 
  DollarSign, 
  Search, 
  Filter, 
  User, 
  Smartphone, 
  MapPin, 
  CreditCard, 
  ChevronRight, 
  ChevronLeft,
  TrendingUp, 
  Package, 
  Layers, 
  Activity, 
  AlertCircle,
  Eye,
  EyeOff,
  Upload,
  RefreshCw,
  Image as ImageIcon,
  Save,
  RotateCcw,
  MonitorPlay,
  Download,
  UploadCloud,
  Database,
  FileJson,
  Archive,
  Calendar,
  History,
  Map as MapIcon,
  Navigation,
  Home,
  Phone,
  Video
} from 'lucide-react';
import { downloadBackupFile, restoreFromBackup } from './backup-service';
import { loadGoogleScript, initializeGoogleAuth, renderGoogleButton, decodeGoogleCredential } from './google-api';

// --- Constants ---

const DEFAULT_LOGO_URL = "https://drive.google.com/uc?export=view&id=1MawsPYwCEJ5ytpKnP34HGpslmjle4b-R";

const DEFAULT_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1615297928064-24977384d0f5?auto=format&fit=crop&w=1920&q=80",
  "https://images.unsplash.com/photo-1551782450-a2132b4ba21d?auto=format&fit=crop&w=1920&q=80"
];

const CONFIG_URL = (import.meta as any).env?.VITE_CONFIG_URL || '/config.json';

// --- Helper Functions ---

const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
            reject(new Error("Canvas context not available"));
        }
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

const isVideo = (url: string) => {
  if (!url) return false;
  // Check for data URI video type or common extensions
  return url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg|mov)$/i);
};

// Normalize external provider URLs (GitHub, Google Drive, etc.) to direct file links
const normalizeGitHubRaw = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname === 'github.com' && u.pathname.includes('/blob/')) {
      const parts = u.pathname.split('/');
      // /<owner>/<repo>/blob/<branch>/<path>
      const owner = parts[1];
      const repo = parts[2];
      const branch = parts[4];
      const path = parts.slice(5).join('/');
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    }
    if (u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/blob/')) {
      const newPath = u.pathname.replace('/blob/', '/');
      return `https://raw.githubusercontent.com${newPath}`;
    }
  } catch {}
  return url;
};

const normalizeDrive = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname === 'drive.google.com') {
      // handle file/d/<id>/view links
      const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)\//);
      const id = fileMatch ? fileMatch[1] : (u.searchParams.get('id') || '');
      if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
  } catch {}
  return url;
};

const normalizeMediaUrl = (url: string) => normalizeDrive(normalizeGitHubRaw(url));

const shouldRenderVideo = (url: string) => {
  const u = normalizeMediaUrl(url);
  if (isVideo(u)) return true;
  try {
    const host = new URL(u).hostname;
    if (host === 'drive.google.com') return true; // Prefer video for Drive assets
  } catch {}
  return false;
};

// --- Types ---

type UserRole = 'admin' | 'client' | 'guest';

interface Address {
  id: string;
  label: string; // Casa, Trabalho
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  addresses?: Address[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
}

interface CartItem extends Product {
  cartId: string;
  quantity: number;
  notes?: string;
}

type OrderStatus = 'pending' | 'preparing' | 'delivery' | 'completed' | 'cancelled';

interface Order {
  id: string;
  userId: string;
  userName: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  address: string;
  paymentMethod: string;
  archived?: boolean; // New field for history
}

// --- Mock Data ---

const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'The Capone Classic',
    description: '180g blend angus, queijo cheddar inglês, bacon caramelizado, cebola roxa e molho secreto.',
    price: 38.90,
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    available: true
  },
  {
    id: '2',
    name: 'Prohibition Chicken',
    description: 'Filé de frango empanado crocante, alface americana, picles e maionese de ervas.',
    price: 29.90,
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1615297928064-24977384d0f5?auto=format&fit=crop&w=800&q=80',
    available: true
  },
  {
    id: '3',
    name: 'Mafia Fries',
    description: 'Batatas rústicas com páprica, cobertas com cheddar cremoso e farofa de bacon.',
    price: 18.00,
    category: 'Sides',
    image: 'https://images.unsplash.com/photo-1573080496987-aeb7d53385c7?auto=format&fit=crop&w=800&q=80',
    available: true
  },
  {
    id: '4',
    name: 'Godfather Shake',
    description: 'Milkshake de chocolate belga com borda de avelã e chantilly.',
    price: 22.00,
    category: 'Drinks',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80',
    available: true
  },
  {
    id: '5',
    name: 'Smugglers Smash',
    description: 'Dois burgers smash 90g, duplo queijo prato e molho da casa no pão brioche.',
    price: 32.50,
    category: 'Burgers',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80',
    available: true
  }
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ORD-001',
    userId: 'user-1',
    userName: 'Cliente Fiel',
    items: [
      { ...MOCK_PRODUCTS[0], cartId: 'c1', quantity: 2 },
      { ...MOCK_PRODUCTS[2], cartId: 'c2', quantity: 1 }
    ],
    total: 95.80,
    status: 'preparing',
    createdAt: new Date(),
    address: 'Rua da Bahia, 123 - Centro, BH',
    paymentMethod: 'Cartão de Crédito',
    archived: false
  },
  {
    id: 'ORD-002',
    userId: 'user-2',
    userName: 'João da Silva',
    items: [
      { ...MOCK_PRODUCTS[1], cartId: 'c3', quantity: 1 }
    ],
    total: 29.90,
    status: 'delivery',
    createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    address: 'Av. Amazonas, 500 - Centro, BH',
    paymentMethod: 'Pix',
    archived: false
  },
  {
    id: 'ORD-003',
    userId: 'user-1',
    userName: 'Cliente Fiel',
    items: [
      { ...MOCK_PRODUCTS[3], cartId: 'c4', quantity: 2 }
    ],
    total: 44.00,
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    address: 'Rua da Bahia, 123 - Centro, BH',
    paymentMethod: 'Dinheiro',
    archived: true // Example of archived order
  }
];

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', ...props }: any) => {
  const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-capone-gold text-capone-900 hover:bg-capone-goldhover shadow-lg shadow-capone-gold/20",
    secondary: "bg-capone-800 text-gray-200 hover:bg-capone-700 border border-capone-700",
    outline: "border border-capone-gold text-capone-gold hover:bg-capone-gold/10",
    danger: "bg-red-900/50 text-red-200 border border-red-800 hover:bg-red-900/80"
  };
  
  return (
    <button 
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-capone-800 rounded-xl border border-capone-700 shadow-xl overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    pending: "bg-yellow-900/50 text-yellow-200 border-yellow-700",
    preparing: "bg-blue-900/50 text-blue-200 border-blue-700",
    delivery: "bg-purple-900/50 text-purple-200 border-purple-700",
    completed: "bg-green-900/50 text-green-200 border-green-700",
    cancelled: "bg-red-900/50 text-red-200 border-red-700"
  };
  
  const icons = {
    pending: Clock,
    preparing: ChefHat,
    delivery: Truck,
    completed: CheckCircle,
    cancelled: X
  };

  const Icon = icons[status];

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 w-fit ${styles[status]}`}>
      <Icon size={12} />
      {status.toUpperCase()}
    </span>
  );
};

const ProductCard: React.FC<{ product: Product; onAdd: (product: Product) => void }> = ({ product, onAdd }) => (
  <Card className="group hover:border-capone-gold/50 transition-colors duration-300 flex flex-col h-full">
    <div className="h-48 overflow-hidden relative">
      <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
      <div className="absolute inset-0 bg-gradient-to-t from-capone-900 to-transparent opacity-80"></div>
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
         <span className="font-serif text-xl font-bold text-white drop-shadow-md">R$ {product.price.toFixed(2)}</span>
      </div>
    </div>
    <div className="p-4 flex flex-col flex-grow">
      <h3 className="font-bold text-lg text-capone-gold mb-1 font-serif">{product.name}</h3>
      <p className="text-gray-400 text-sm mb-4 flex-grow line-clamp-2">{product.description}</p>
      <Button onClick={() => onAdd(product)} className="w-full mt-auto text-sm">
        <Plus size={16} /> Adicionar
      </Button>
    </div>
  </Card>
);

const ProductSkeleton = () => (
  <Card className="h-full flex flex-col animate-pulse">
    <div className="h-48 bg-capone-700/50" />
    <div className="p-4 flex flex-col flex-grow space-y-4">
      <div className="h-6 bg-capone-700/50 rounded w-3/4" />
      <div className="space-y-2 flex-grow">
        <div className="h-3 bg-capone-700/30 rounded w-full" />
        <div className="h-3 bg-capone-700/30 rounded w-full" />
        <div className="h-3 bg-capone-700/30 rounded w-2/3" />
      </div>
      <div className="h-9 bg-capone-700/50 rounded w-full mt-auto" />
    </div>
  </Card>
);

const WhatsAppButton = () => (
  <a
    href="https://wa.me/5531982285267" // Use o número real aqui
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:bg-[#20bd5a] hover:scale-110 transition-all duration-300 flex items-center justify-center group"
    aria-label="Fale conosco no WhatsApp"
  >
    {/* Ícone SVG do WhatsApp */}
    <svg 
      viewBox="0 0 24 24" 
      width="32" 
      height="32" 
      stroke="currentColor" 
      strokeWidth="0" 
      fill="currentColor" 
      className="w-8 h-8"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
    
    {/* Tooltip */}
    <span className="absolute right-full mr-3 bg-white text-capone-900 px-3 py-1 rounded-lg text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
      Peça pelo Zap!
    </span>
  </a>
);

// --- Extracted Components (Fixed focus issues) ---

interface AuthViewProps {
  loginEmail: string;
  setLoginEmail: (val: string) => void;
  loginPass: string;
  setLoginPass: (val: string) => void;
  showPassword: boolean;
  setShowPassword: (val: boolean) => void;
  rememberMe: boolean;
  setRememberMe: (val: boolean) => void;
  loginError: string;
  handleLogin: (e: React.FormEvent) => void;
  appLogo: string;
  onGoogleLogin: (user: User) => void;
}

const AuthView: React.FC<AuthViewProps> = ({
  loginEmail, setLoginEmail,
  loginPass, setLoginPass,
  showPassword, setShowPassword,
  rememberMe, setRememberMe,
  loginError, handleLogin,
  appLogo, onGoogleLogin
}) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGoogleScript(() => {
      initializeGoogleAuth((response: any) => {
        const payload = decodeGoogleCredential(response.credential);
        if (payload) {
          const googleUser: User = {
            id: payload.sub, // Google unique ID
            name: payload.name,
            email: payload.email,
            role: 'client',
            avatar: payload.picture
          };
          onGoogleLogin(googleUser);
        }
      });
      
      if (googleBtnRef.current) {
        renderGoogleButton('google-btn-container');
      }
    });
  }, [onGoogleLogin]);

  return (
  <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
    <Card className="w-full max-w-md p-8 relative z-10 border-capone-gold/30">
      <div className="flex flex-col items-center mb-8">
        <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-capone-gold/30 shadow-2xl shadow-capone-gold/10 mb-4 bg-black">
          <img src={normalizeMediaUrl(appLogo)} alt="Al Capone Burger" className="w-full h-full object-cover" crossOrigin="anonymous" />
        </div>
        <p className="text-gray-400 tracking-widest text-sm uppercase">Authentic Burger Mafia</p>
      </div>
      
      <form onSubmit={handleLogin} className="space-y-4">
        {loginError && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 text-sm p-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} />
            {loginError}
          </div>
        )}
        <div>
          <label className="block text-sm text-gray-400 mb-1">E-mail</label>
          <input 
            type="email" 
            value={loginEmail}
            onChange={e => setLoginEmail(e.target.value)}
            className="w-full bg-capone-900 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none transition-colors"
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Senha</label>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              value={loginPass}
              onChange={e => setLoginPass(e.target.value)}
              className="w-full bg-capone-900 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none transition-colors pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-capone-gold transition-colors"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="remember" 
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-capone-700 bg-capone-900 text-capone-gold focus:ring-capone-gold"
            />
            <label htmlFor="remember" className="text-sm text-gray-400 cursor-pointer select-none">
              Lembrar-me
            </label>
        </div>
        
        <Button type="submit" className="w-full py-3 text-lg font-serif">
          Entrar
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-capone-700"></div></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-capone-800 text-gray-500">ou continue com</span></div>
        </div>

        <div id="google-btn-container" ref={googleBtnRef}></div>
      </form>
      
      {/*
      <div className="mt-6 text-center text-xs text-gray-500 border-t border-capone-700/50 pt-4">
        <p className="mb-1 text-gray-400">Credenciais de Teste:</p>
        //<p>Admin: <span className="text-capone-gold font-mono">admin@alcapone.com</span> / <span className="text-capone-gold font-mono">admin123</span></p>
        //<p>Cliente: <span className="text-capone-gold font-mono">user@email.com</span> / <span className="text-capone-gold font-mono">123456</span></p>
      </div>
      */}
    </Card>
  </div>
  );
};

interface ProfileViewProps {
  user: User;
  onSaveProfile: (u: User) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onSaveProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar || '');
  
  // Address Modal State
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState<Partial<Address>>({
    label: 'Casa',
    zipCode: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  // Reset local state when user changes
  useEffect(() => {
      setName(user.name);
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar || '');
  }, [user]);

  const handleSaveProfile = () => {
    onSaveProfile({ ...user, name, phone, avatar: avatarUrl ? normalizeMediaUrl(avatarUrl) : user.avatar });
    setIsEditing(false);
  };

  const handleAddAddress = () => {
    if (!newAddress.street || !newAddress.number || !newAddress.zipCode) {
      alert("Preencha os campos obrigatórios.");
      return;
    }
    const address: Address = {
      id: Math.random().toString(),
      ...newAddress as Address
    };
    const updatedAddresses = [...(user.addresses || []), address];
    onSaveProfile({ ...user, addresses: updatedAddresses });
    setShowAddressModal(false);
    setNewAddress({ label: 'Casa', zipCode: '', street: '', number: '', neighborhood: '', city: '', state: '' });
  };

  const handleDeleteAddress = (id: string) => {
    if (confirm('Excluir este endereço?')) {
      const updatedAddresses = user.addresses?.filter(a => a.id !== id) || [];
      onSaveProfile({ ...user, addresses: updatedAddresses });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-serif text-white mb-8 flex items-center gap-3">
        <User className="text-capone-gold"/> Meu Perfil
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Personal Info */}
        <Card className="p-6 md:col-span-1 h-fit">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-capone-gold mb-4">
              <img src={normalizeMediaUrl(user.avatar || ("https://ui-avatars.com/api/?name=" + user.name))} alt="Avatar" className="w-full h-full object-cover" crossOrigin="anonymous" />
            </div>
            {!isEditing ? (
              <>
                <h3 className="text-xl font-bold text-white">{user.name}</h3>
                <p className="text-gray-400 text-sm mb-1">{user.email}</p>
                <p className="text-capone-gold text-sm font-mono">{user.phone || 'Sem telefone'}</p>
                <Button variant="outline" className="mt-4 w-full" onClick={() => setIsEditing(true)}>
                  <Edit2 size={14}/> Editar Dados
                </Button>
              </>
            ) : (
              <div className="w-full space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block text-left mb-1">Nome</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full bg-capone-900 border border-capone-700 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block text-left mb-1">Telefone</label>
                  <input 
                    type="tel" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="(00) 00000-0000"
                    className="w-full bg-capone-900 border border-capone-700 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block text-left mb-1">Avatar (URL)</label>
                  <input 
                    type="url" 
                    value={avatarUrl} 
                    onChange={e => setAvatarUrl(e.target.value)} 
                    placeholder="https://..."
                    className="w-full bg-capone-900 border border-capone-700 rounded px-2 py-1 text-white text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 text-xs" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  <Button className="flex-1 text-xs" onClick={handleSaveProfile}>Salvar</Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Addresses */}
        <div className="md:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <MapIcon size={20} className="text-gray-400"/> Meus Endereços
            </h3>
            <Button onClick={() => setShowAddressModal(true)} className="text-sm">
              <Plus size={16}/> Novo Endereço
            </Button>
          </div>

          <div className="grid gap-4">
            {user.addresses?.map(addr => (
              <Card key={addr.id} className="p-4 flex justify-between items-center">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-capone-900 rounded-full text-capone-gold">
                    {addr.label.toLowerCase().includes('casa') ? <Home size={20}/> : <MapIcon size={20}/>}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-capone-gold uppercase tracking-wider">{addr.label}</span>
                    <p className="text-white font-medium">{addr.street}, {addr.number}</p>
                    <p className="text-sm text-gray-400">{addr.neighborhood} - {addr.city}/{addr.state}</p>
                    <p className="text-xs text-gray-500 mt-1">CEP: {addr.zipCode}</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteAddress(addr.id)} className="text-gray-600 hover:text-red-500 transition-colors p-2">
                  <Trash2 size={18}/>
                </button>
              </Card>
            ))}
            {(!user.addresses || user.addresses.length === 0) && (
              <div className="text-center py-8 border-2 border-dashed border-capone-800 rounded-xl text-gray-500">
                <MapIcon size={32} className="mx-auto mb-2 opacity-50"/>
                <p>Nenhum endereço cadastrado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 bg-capone-900 border-capone-gold/50 shadow-2xl">
            <h3 className="text-2xl font-serif text-white mb-6">Adicionar Endereço</h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase">Rótulo</label>
                  <input 
                    className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                    placeholder="Ex: Casa, Trabalho"
                    value={newAddress.label}
                    onChange={e => setNewAddress({...newAddress, label: e.target.value})}
                  />
                </div>
                <div className="w-1/3">
                  <label className="text-xs text-gray-500 uppercase">CEP</label>
                  <input 
                    className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                    placeholder="00000-000"
                    value={newAddress.zipCode}
                    onChange={e => setNewAddress({...newAddress, zipCode: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-[3]">
                  <label className="text-xs text-gray-500 uppercase">Rua</label>
                  <input 
                    className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                    value={newAddress.street}
                    onChange={e => setNewAddress({...newAddress, street: e.target.value})}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase">Número</label>
                  <input 
                    className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                    value={newAddress.number}
                    onChange={e => setNewAddress({...newAddress, number: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase">Bairro</label>
                <input 
                  className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                  value={newAddress.neighborhood}
                  onChange={e => setNewAddress({...newAddress, neighborhood: e.target.value})}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-[2]">
                  <label className="text-xs text-gray-500 uppercase">Cidade</label>
                  <input 
                    className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                    value={newAddress.city}
                    onChange={e => setNewAddress({...newAddress, city: e.target.value})}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase">Estado</label>
                  <input 
                    className="w-full bg-capone-800 border border-capone-700 rounded p-2 text-white" 
                    placeholder="UF"
                    value={newAddress.state}
                    onChange={e => setNewAddress({...newAddress, state: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" className="flex-1" onClick={() => setShowAddressModal(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={handleAddAddress}>Salvar Endereço</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

interface AdminBannersProps {
  heroImages: string[];
  handleAddHeroImage: (url: string) => void;
  handleRemoveHeroImage: (index: number) => void;
  handleHeroImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleResetHeroImages: () => void;
}

const AdminBanners: React.FC<AdminBannersProps> = ({
  heroImages,
  handleAddHeroImage,
  handleRemoveHeroImage,
  handleHeroImageUpload,
  handleResetHeroImages
}) => {
  const [newUrl, setNewUrl] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-white">Banners da Home</h2>
        <Button variant="outline" onClick={handleResetHeroImages}><RotateCcw size={16} /> Restaurar Padrão</Button>
      </div>

      <Card className="p-6">
        <h3 className="font-bold text-white mb-4">Adicionar Nova Mídia (Imagem ou Vídeo)</h3>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 flex gap-2">
            <input 
              type="text" 
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Cole a URL da imagem ou vídeo aqui..."
              className="flex-1 bg-capone-900 border border-capone-700 rounded-lg px-4 py-2 text-white focus:border-capone-gold outline-none"
            />
            <Button onClick={() => { handleAddHeroImage(newUrl); setNewUrl(''); }}>Adicionar</Button>
          </div>
          <div className="relative">
            <input 
              type="file" 
              accept="image/*,video/*"
              onChange={handleHeroImageUpload}
              className="hidden" 
              id="banner-upload"
            />
            <label 
              htmlFor="banner-upload"
              className="flex items-center gap-2 px-4 py-2 bg-capone-800 border border-capone-700 text-gray-200 rounded-lg hover:bg-capone-700 cursor-pointer font-medium"
            >
              <Upload size={18} /> Upload Mídia
            </label>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {heroImages.map((m, index) => {
           const media = normalizeMediaUrl(m);
           const renderVideo = shouldRenderVideo(media);
           return (
           <Card key={index} className="overflow-hidden group relative">
             <div className="aspect-video relative bg-black">
               {renderVideo ? (
                 <video src={media} className="w-full h-full object-cover" muted loop playsInline autoPlay crossOrigin="anonymous" />
               ) : (
                 <img src={media} alt={`Banner ${index}`} className="w-full h-full object-cover" crossOrigin="anonymous" />
               )}
                <div className="absolute inset-0 bg-black/50 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <Button variant="danger" onClick={() => handleRemoveHeroImage(index)}>
                    <Trash2 size={20} /> Remover
                  </Button>
                </div>
               <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                 {renderVideo && <Video size={12} className="text-capone-gold" />} Slide {index + 1}
               </div>
             </div>
           </Card>
         );})}
          </div>
    </div>
  );
};


// --- App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('home'); // home, menu, cart, profile, admin-dash, admin-products, admin-orders, admin-integrations, admin-settings, admin-banners
  
  // Products State with Persistence
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const savedProducts = localStorage.getItem('capone_products');
      return savedProducts ? JSON.parse(savedProducts) : MOCK_PRODUCTS;
    } catch (e) {
      console.error("Failed to parse products from local storage", e);
      return MOCK_PRODUCTS;
    }
  });

  // Cart State with Persistence
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('capone_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      console.error("Failed to parse cart from local storage", e);
      return [];
    }
  });

  // Hero Images State with Persistence
  const [heroImages, setHeroImages] = useState<string[]>(() => {
    try {
      const savedImages = localStorage.getItem('capone_hero_images');
      return savedImages ? JSON.parse(savedImages) : DEFAULT_HERO_IMAGES;
    } catch (e) {
      console.error("Failed to parse hero images from local storage", e);
      return DEFAULT_HERO_IMAGES;
    }
  });

  // Orders State with Persistence (Fixed for Backup functionality)
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const savedOrders = localStorage.getItem('capone_orders');
      if (savedOrders) {
         return JSON.parse(savedOrders);
      }
      return MOCK_ORDERS;
    } catch (e) {
      console.error("Failed to parse orders from local storage", e);
      return MOCK_ORDERS;
    }
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Logo State (Persistence)
  const [appLogo, setAppLogo] = useState(() => {
    const src = localStorage.getItem('capone_logo') || DEFAULT_LOGO_URL;
    return normalizeMediaUrl(src);
  });

  // Admin Product Logic (Form State moved to App level to avoid remounting issues)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    category: 'Burgers',
    image: '',
    available: true
  });

  // Load saved credentials on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('capone_email');
    const savedPass = localStorage.getItem('capone_pass');
    if (savedEmail && savedPass) {
      setLoginEmail(savedEmail);
      setLoginPass(savedPass);
      setRememberMe(true);
    }
  }, []);

  // Save products whenever they change
  useEffect(() => {
    localStorage.setItem('capone_products', JSON.stringify(products));
  }, [products]);

  // Save cart whenever it changes
  useEffect(() => {
    localStorage.setItem('capone_cart', JSON.stringify(cart));
  }, [cart]);

  // Save Orders whenever they change (New for Backup)
  useEffect(() => {
    localStorage.setItem('capone_orders', JSON.stringify(orders));
  }, [orders]);

  // Save Hero Images whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('capone_hero_images', JSON.stringify(heroImages));
    } catch (e) {
      console.error("Failed to save hero images to localStorage - quota likely exceeded", e);
      alert("Aviso: Limite de armazenamento do navegador excedido. Algumas imagens podem não ser salvas para a próxima sessão.");
    }
  }, [heroImages]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(CONFIG_URL, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version) {
          const prev = localStorage.getItem('capone_config_version');
          if (prev !== String(data.version)) {
            try { localStorage.removeItem('capone_products'); } catch {}
            localStorage.setItem('capone_config_version', String(data.version));
          }
        }
        if (data.logo) {
          const normalized = normalizeMediaUrl(data.logo);
          setAppLogo(normalized);
          try { localStorage.setItem('capone_logo', normalized); } catch {}
        }
        if (Array.isArray(data.banners) && data.banners.length) {
          setHeroImages(data.banners);
          try { localStorage.setItem('capone_hero_images', JSON.stringify(data.banners)); } catch {}
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/products.json', { cache: 'no-store' });
        if (!r.ok) return;
        const remote = await r.json();
        if (Array.isArray(remote) && remote.length) {
          setProducts(remote);
          try { localStorage.setItem('capone_products', JSON.stringify(remote)); } catch {}
        }
      } catch {}
    })();
  }, []);

  // Sync Form Data with Editing Product
  useEffect(() => {
    if (editingProduct) {
      setProductFormData(editingProduct);
    } else {
      setProductFormData({
        name: '',
        description: '',
        price: 0,
        category: 'Burgers',
        image: '',
        available: true
      });
    }
  }, [editingProduct, isProductModalOpen]);

  // Helper to load user profile data
  const loadUserProfile = (baseUser: User): User => {
    const savedProfile = localStorage.getItem(`capone_profile_${baseUser.id}`);
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      return { ...baseUser, ...profile };
    }
    return baseUser;
  };

  const saveUserProfile = (updatedUser: User) => {
    const profileData = {
      phone: updatedUser.phone,
      addresses: updatedUser.addresses,
      name: updatedUser.name // allow name updates
    };
    localStorage.setItem(`capone_profile_${updatedUser.id}`, JSON.stringify(profileData));
    setUser(updatedUser);
  };

  // Computed
  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Actions
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // Admin Validation
    if (loginEmail.toLowerCase().includes('admin')) {
      // Allow multiple password variations for easier testing
      if (['admin123', 'admin', '123456'].includes(loginPass)) {
        loginSuccess({ id: 'admin-1', name: 'Al Capone Admin', email: loginEmail, role: 'admin' }, 'admin-dash');
        return;
      } else {
        setLoginError('Senha de administrador incorreta (Tente: admin123).');
        return;
      }
    }

    // Client Validation
    if (loginEmail.includes('@') && loginPass.length >= 6) {
       loginSuccess({ id: loginEmail, name: 'Cliente', email: loginEmail, role: 'client' }, 'home');
    } else {
      setLoginError('Credenciais inválidas. Verifique seu e-mail e senha (mín. 6 caracteres).');
    }
  };

  const loginSuccess = (baseUser: User, redirectView: string) => {
    const fullUser = loadUserProfile(baseUser);
    setUser(fullUser);
    setView(redirectView);
    if (rememberMe && baseUser.role !== 'admin') { // Don't remember admin for safety in this mock
      localStorage.setItem('capone_email', baseUser.email);
      // We don't save password if it's google login usually, but here we simulate
      if (loginPass) localStorage.setItem('capone_pass', loginPass);
    } else {
      localStorage.removeItem('capone_email');
      localStorage.removeItem('capone_pass');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setView('home');
    setCart([]);
    setLoginError('');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Compress image to ensure it saves. 500px width, 0.9 quality
        const compressedBase64 = await compressImage(file, 500, 0.9);
        setAppLogo(compressedBase64);
        try {
            localStorage.setItem('capone_logo', compressedBase64);
            alert('Logo atualizada e salva com sucesso!');
        } catch (storageError) {
            alert('Logo atualizada, mas não foi possível salvar no navegador (limite excedido). Tente uma imagem menor.');
        }
      } catch (error) {
        console.error("Error processing logo", error);
        alert("Erro ao processar imagem da logo.");
      }
    }
  };

  const handleLogoUrlSave = (url: string) => {
    if (!url) return;
    const normalized = normalizeMediaUrl(url);
    setAppLogo(normalized);
    try { localStorage.setItem('capone_logo', normalized); } catch {}
    alert('Logo atualizada por URL externa.');
  };

  const handleResetLogo = () => {
    if (confirm('Tem certeza que deseja restaurar a logo padrão?')) {
      setAppLogo(DEFAULT_LOGO_URL);
      localStorage.removeItem('capone_logo');
    }
  };

  const handleResetMenu = () => {
    if (confirm('Atenção: Isso irá apagar todas as alterações e restaurar o cardápio original de demonstração. Deseja continuar?')) {
      setProducts(MOCK_PRODUCTS);
      alert('Cardápio restaurado com sucesso!');
    }
  };

  // --- Hero Images Actions ---
  const handleAddHeroImage = (url: string) => {
    if (url) {
      setHeroImages([...heroImages, url]);
    }
  };

  const handleRemoveHeroImage = (index: number) => {
    const newImages = [...heroImages];
    newImages.splice(index, 1);
    setHeroImages(newImages);
  };

  const handleResetHeroImages = () => {
    if (confirm('Deseja restaurar as imagens originais do banner?')) {
      setHeroImages(DEFAULT_HERO_IMAGES);
    }
  };

  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // Check if file is a video
        if (file.type.startsWith('video/')) {
          if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert("Vídeos devem ter no máximo 5MB para serem salvos no navegador. Recomendamos usar URLs externas.");
            return;
          }
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
          setHeroImages(prev => [...prev, base64]);
        } else {
          // Compress image. 1920px max width, 0.7 quality to save space
          const compressedBase64 = await compressImage(file, 1920, 0.7);
          setHeroImages(prev => [...prev, compressedBase64]);
        }
      } catch (error) {
        console.error("Error processing banner", error);
        alert("Erro ao processar arquivo do banner.");
      }
    }
  };

  // CRUD Products
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const product = productFormData as Product;
    
    if (!product.name || !product.price) {
      alert("Preencha o nome e o preço.");
      return;
    }

    let next: Product[] = [];
    if (product.id) {
      next = products.map(p => p.id === product.id ? product : p);
    } else {
      const newProduct = { ...product, id: Math.random().toString() };
      next = [...products, newProduct];
    }
    setProducts(next);
    syncProductsRemote(next);
    setIsProductModalOpen(false);
    setEditingProduct(null);
  };

  const handleDeleteProduct = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      const next = products.filter(p => p.id !== id);
      setProducts(next);
      syncProductsRemote(next);
    }
  };

  const openProductModal = (product?: Product) => {
    setEditingProduct(product || null);
    setIsProductModalOpen(true);
  };

  const syncProductsRemote = async (nextProducts: Product[]) => {
    try {
      const resp = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: nextProducts })
      });
      if (!resp.ok) throw new Error('remote update failed');
    } catch (err) {
      console.warn('Falha ao sincronizar catálogo remoto. Configure GITHUB_TOKEN no Vercel.', err);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, cartId: Math.random().toString(), quantity: 1 }];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const placeOrder = () => {
    if (!user) {
      alert("Faça login para finalizar o pedido.");
      return;
    }
    const newOrder: Order = {
      id: `ORD-${Math.floor(Math.random() * 1000)}`,
      userId: user.id,
      userName: user.name,
      items: [...cart],
      total: cartTotal,
      status: 'pending',
      createdAt: new Date(),
      address: 'Endereço Padrão do Cliente',
      paymentMethod: 'Cartão de Crédito',
      archived: false
    };
    setOrders([newOrder, ...orders]);
    setCart([]);
    setView(user.role === 'admin' ? 'admin-orders' : 'orders');
    alert("Pedido realizado com sucesso!");
  };

  // --- Views ---

  // AuthView removed from here and extracted to top level

  const Navbar = () => (
    <nav className="fixed top-0 w-full z-50 bg-capone-900/90 backdrop-blur-md border-b border-capone-700 h-16 px-4 md:px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button className="md:hidden text-capone-gold" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <MenuIcon />}
        </button>
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => setView(user?.role === 'admin' ? 'admin-dash' : 'home')}
        >
          <div className="w-10 h-10 rounded-full overflow-hidden border border-capone-gold/50 group-hover:border-capone-gold transition-colors">
            <img src={normalizeMediaUrl(appLogo)} alt="Logo" className="w-full h-full object-cover" crossOrigin="anonymous" />
          </div>
          <span className="font-serif font-bold text-xl tracking-wider hidden sm:block text-capone-gold">AL CAPONE</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-300">
              {user.avatar ? (
                <img src={user.avatar} className="w-8 h-8 rounded-full border border-capone-gold" />
              ) : (
                <User size={16} />
              )}
              <div className="flex flex-col">
                <span>{user.name}</span>
                {user.role === 'client' && <button onClick={() => setView('profile')} className="text-[10px] text-capone-gold text-left hover:underline">Meu Perfil</button>}
              </div>
            </div>
            {user.role === 'client' && (
              <button 
                onClick={() => setView('cart')}
                className="relative p-2 text-capone-gold hover:bg-capone-800 rounded-full transition-colors"
              >
                <ShoppingBag size={24} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <Button variant="outline" className="text-xs px-3 py-1" onClick={() => setView('auth')}>Login</Button>
        )}
      </div>
    </nav>
  );

  // --- Admin Screens ---

  const AdminSidebar = () => (
    <div className={`fixed inset-y-0 left-0 w-64 bg-capone-900 border-r border-capone-700 transform ${isMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'} md:translate-x-0 md:pointer-events-auto transition-transform duration-300 z-40 pt-20`} aria-hidden={!isMenuOpen && window.innerWidth < 768}>
      <div className="px-4 py-2 space-y-2">
        <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Gerenciamento</p>
        <button onClick={() => setView('admin-dash')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin-dash' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <LayoutDashboard size={20} /> Dashboard
        </button>
        <button onClick={() => setView('admin-orders')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin-orders' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <Layers size={20} /> Pedidos
        </button>
        <button onClick={() => setView('admin-products')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin-products' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <Package size={20} /> Cardápio
        </button>
        
        <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mt-6 mb-2">Configuração</p>
        <button onClick={() => setView('admin-banners')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin-banners' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <ImageIcon size={20} /> Banners
        </button>
        <button onClick={() => setView('admin-integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin-integrations' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <Activity size={20} /> Integrações
        </button>
        <button onClick={() => setView('admin-settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin-settings' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <Settings size={20} /> Ajustes
        </button>
      </div>
    </div>
  );

  const ClientSidebar = () => (
    <div className={`fixed inset-y-0 left-0 w-64 bg-capone-900 border-r border-capone-700 transform ${isMenuOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'} md:hidden transition-transform duration-300 z-40 pt-20`} aria-hidden={!isMenuOpen}>
      <div className="px-4 py-2 space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-capone-700">
          {user?.avatar ? (
            <img src={normalizeMediaUrl(user.avatar)} className="w-8 h-8 rounded-full border border-capone-gold" crossOrigin="anonymous" />
          ) : (
            <User size={16} />
          )}
          <div className="flex-1">
            <span className="block text-white text-sm">{user?.name || 'Cliente'}</span>
            <button onClick={() => { setView('profile'); setIsMenuOpen(false); }} className="text-[10px] text-capone-gold text-left hover:underline">Meu Perfil</button>
          </div>
        </div>

        <button onClick={() => { setView('home'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'home' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <ChefHat size={20} /> Cardápio
        </button>
        <button onClick={() => { setView('orders'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'orders' ? 'bg-capone-gold text-capone-900 font-bold' : 'text-gray-400 hover:bg-capone-800'}`}>
          <ShoppingBag size={20} /> Meus Pedidos
        </button>
        <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-capone-800 transition-colors">
          <LogOut size={20} /> Sair
        </button>
      </div>
    </div>
  );

  // AdminBanners removed from here and extracted to top level

  const AdminSettings = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [logoUrl, setLogoUrl] = useState('');

    const handleRestoreClick = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (confirm("ATENÇÃO: Restaurar um backup substituirá TODOS os dados atuais (Produtos, Pedidos, Configurações). Deseja continuar?")) {
           const result = await restoreFromBackup(file);
           alert(result.message);
           if (result.success) {
             window.location.reload();
           }
        }
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
    <div className="space-y-6">
      <h2 className="text-3xl font-serif text-white">Ajustes do Sistema</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Identidade Visual */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-capone-700">
             <div className="p-2 bg-capone-900 rounded-lg text-capone-gold">
               <ImageIcon size={24} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-white">Identidade Visual</h3>
               <p className="text-sm text-gray-400">Gerencie a marca do seu restaurante</p>
             </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col items-center p-6 bg-capone-900 rounded-xl border border-dashed border-capone-700">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-capone-gold mb-4 relative group">
                <img src={normalizeMediaUrl(appLogo)} alt="Current Logo" className="w-full h-full object-cover" crossOrigin="anonymous" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-bold">Atual</span>
                </div>
              </div>
              
              <div className="w-full space-y-3">
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleLogoUpload}
                    className="hidden" 
                    id="logo-upload"
                  />
                  <label 
                    htmlFor="logo-upload"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-capone-gold text-capone-900 rounded-lg font-bold cursor-pointer hover:bg-capone-goldhover transition-colors"
                  >
                    <Upload size={18} /> Carregar Nova Logo
                  </label>
                </div>

                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={logoUrl} 
                    onChange={(e) => setLogoUrl(e.target.value)} 
                    placeholder="https://link-da-logo"
                    className="flex-1 bg-capone-900 border border-capone-700 rounded-lg px-4 py-2 text-white"
                  />
                  <Button onClick={() => handleLogoUrlSave(logoUrl)}>Salvar URL</Button>
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={handleResetLogo}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RefreshCw size={18} /> Restaurar Logo Padrão
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Backup & Dados */}
        <Card className="p-6">
           <div className="flex items-center gap-3 mb-6 pb-4 border-b border-capone-700">
             <div className="p-2 bg-capone-900 rounded-lg text-blue-400">
               <Database size={24} />
             </div>
             <div>
               <h3 className="text-xl font-bold text-white">Dados e Backup</h3>
               <p className="text-sm text-gray-400">Segurança e restauração</p>
             </div>
          </div>
          
          <div className="space-y-6">
             <div className="bg-capone-900/50 p-4 rounded-lg border border-capone-700/50">
               <div className="flex items-center gap-2 text-green-400 mb-2">
                 <CheckCircle size={16} />
                 <span className="text-sm font-bold">Salvamento Automático Ativo</span>
               </div>
               <p className="text-xs text-gray-400">
                 Todos os pedidos, clientes e alterações são salvos automaticamente no armazenamento local do seu navegador em tempo real (até os últimos segundos).
               </p>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <button 
                 onClick={downloadBackupFile}
                 className="flex flex-col items-center justify-center gap-2 p-4 bg-capone-800 border border-capone-700 rounded-xl hover:bg-capone-700 hover:border-capone-gold transition-all group"
               >
                 <Download size={24} className="text-gray-400 group-hover:text-capone-gold transition-colors" />
                 <span className="text-sm font-medium text-gray-200">Baixar Backup</span>
               </button>

               <button 
                 onClick={handleRestoreClick}
                 className="flex flex-col items-center justify-center gap-2 p-4 bg-capone-800 border border-capone-700 rounded-xl hover:bg-capone-700 hover:border-blue-400 transition-all group"
               >
                 <UploadCloud size={24} className="text-gray-400 group-hover:text-blue-400 transition-colors" />
                 <span className="text-sm font-medium text-gray-200">Restaurar Dados</span>
               </button>
               <input 
                 type="file" 
                 accept=".json" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleFileChange}
               />
             </div>

             <div className="pt-4 border-t border-capone-700">
               <p className="text-xs text-gray-500 mb-3">Zona de Perigo</p>
               <Button 
                  variant="danger" 
                  onClick={handleResetMenu}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> Resetar Fábrica (Apenas Cardápio)
                </Button>
             </div>
          </div>
        </Card>
      </div>
    </div>
  );
  };

  const AdminDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-3xl font-serif text-white">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border-l-4 border-l-capone-gold">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Vendas Hoje</p>
              <h3 className="text-2xl font-bold text-white mt-1">R$ 1.250,00</h3>
            </div>
            <DollarSign className="text-capone-gold opacity-50" />
          </div>
          <p className="text-green-400 text-xs mt-4 flex items-center gap-1"><TrendingUp size={12}/> +12% vs ontem</p>
        </Card>
        <Card className="p-6 border-l-4 border-l-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Pedidos Ativos</p>
              <h3 className="text-2xl font-bold text-white mt-1">8</h3>
            </div>
            <ChefHat className="text-blue-500 opacity-50" />
          </div>
          <p className="text-gray-400 text-xs mt-4">4 na cozinha, 4 em rota</p>
        </Card>
        <Card className="p-6 border-l-4 border-l-purple-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm">Integrações</p>
              <h3 className="text-2xl font-bold text-white mt-1">Online</h3>
            </div>
            <Activity className="text-purple-500 opacity-50" />
          </div>
          <div className="flex gap-2 mt-4">
            <span className="w-2 h-2 rounded-full bg-red-500" title="iFood"></span>
            <span className="w-2 h-2 rounded-full bg-orange-500" title="Rappi"></span>
            <span className="w-2 h-2 rounded-full bg-black border border-gray-600" title="Uber"></span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Últimos Pedidos</h3>
          <div className="space-y-4">
            {orders.filter(o => !o.archived).slice(0, 4).map(order => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-capone-900 rounded-lg border border-capone-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{order.id}</span>
                    <Badge status={order.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{order.userName} • {order.items.length} itens</p>
                </div>
                <span className="font-mono text-capone-gold">R$ {order.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
        
        <Card className="p-6">
          <h3 className="text-lg font-bold text-white mb-4">Status da Cozinha</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Tempo Médio de Preparo</span>
              <span className="text-white">18 min</span>
            </div>
            <div className="w-full bg-capone-900 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '30%' }}></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const AdminIntegrations = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-serif text-white">Integrações de Delivery</h2>
        <Button variant="outline">
          <Activity size={16} /> Ver Logs
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        {/* iFood */}
        <Card className="p-6 border border-capone-700">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold">iF</div>
              <div>
                <h3 className="text-xl font-bold text-white">iFood</h3>
                <p className="text-sm text-gray-400">Sincronização de catálogo e pedidos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              <span className="text-sm text-green-400 font-medium">Conectado</span>
            </div>
          </div>
          <div className="bg-capone-900 p-4 rounded-lg space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 uppercase">Merchant ID</label>
              <div className="flex gap-2">
                <input type="text" value="384-281-992-1" disabled className="flex-1 bg-transparent border-none text-gray-300 focus:ring-0 text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase">Client Secret</label>
              <input type="password" value="************************" disabled className="w-full bg-transparent border-none text-gray-300 focus:ring-0 text-sm font-mono" />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1 text-sm">Sincronizar Cardápio</Button>
            <Button variant="outline" className="text-sm">Configurar</Button>
          </div>
        </Card>

        {/* Rappi */}
        <Card className="p-6 border border-capone-700 opacity-70">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">Ra</div>
              <div>
                <h3 className="text-xl font-bold text-white">Rappi</h3>
                <p className="text-sm text-gray-400">Pedidos via Webhook</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-500"></span>
              <span className="text-sm text-gray-400 font-medium">Inativo</span>
            </div>
          </div>
          <div className="bg-capone-900 p-4 rounded-lg border border-dashed border-gray-700 flex flex-col items-center justify-center py-8 mb-4">
            <p className="text-gray-500 text-sm mb-2">Integração não configurada</p>
            <Button variant="primary" className="text-sm">Adicionar Credenciais</Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const AdminOrders = () => {
    // ... (AdminOrders component logic is maintained)
    const [viewMode, setViewMode] = useState<'kanban' | 'history'>('kanban');
    const [historyFilter, setHistoryFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

    const handleMoveOrder = (orderId: string, direction: 'next' | 'prev') => {
       const statusFlow: OrderStatus[] = ['pending', 'preparing', 'delivery', 'completed'];
       const order = orders.find(o => o.id === orderId);
       if (!order) return;
       
       const currentIndex = statusFlow.indexOf(order.status);
       let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
       
       // Boundary checks
       if (newIndex < 0) newIndex = 0;
       if (newIndex >= statusFlow.length) newIndex = statusFlow.length - 1;
       
       const newStatus = statusFlow[newIndex];
       setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    };

    const handleArchiveCompleted = () => {
      if (confirm('Deseja arquivar todos os pedidos concluídos? Eles sairão do quadro e ficarão disponíveis no histórico.')) {
        setOrders(orders.map(o => o.status === 'completed' ? { ...o, archived: true } : o));
      }
    };

    const getHistoryOrders = () => {
       const archivedOrders = orders.filter(o => o.archived);
       const now = new Date();
       
       return archivedOrders.filter(order => {
          const orderDate = new Date(order.createdAt);
          if (historyFilter === 'all') return true;
          
          if (historyFilter === 'today') {
            return orderDate.getDate() === now.getDate() && 
                   orderDate.getMonth() === now.getMonth() && 
                   orderDate.getFullYear() === now.getFullYear();
          }

          if (historyFilter === 'week') {
             const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
             return orderDate >= weekAgo;
          }

          if (historyFilter === 'month') {
             return orderDate.getMonth() === now.getMonth() && 
                    orderDate.getFullYear() === now.getFullYear();
          }
          return true;
       });
    };

    const historyOrders = getHistoryOrders();
    const historyTotal = historyOrders.reduce((acc, curr) => acc + curr.total, 0);

    return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-serif text-white">{viewMode === 'kanban' ? 'Gestão de Pedidos' : 'Histórico de Vendas'}</h2>
        <div className="flex gap-2">
          {viewMode === 'kanban' ? (
             <>
               <Button variant="secondary" onClick={() => setViewMode('history')}>
                  <History size={16}/> Histórico
               </Button>
               <Button variant="danger" onClick={handleArchiveCompleted} title="Arquivar Concluídos">
                  <Archive size={16}/> Fechar Dia
               </Button>
             </>
          ) : (
             <Button variant="secondary" onClick={() => setViewMode('kanban')}>
                  <Layers size={16}/> Voltar para Kanban
             </Button>
          )}
        </div>
      </div>
      
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 min-w-[1000px] h-full pb-4">
            {['pending', 'preparing', 'delivery', 'completed'].map(status => (
              <div key={status} className="w-1/4 bg-capone-900/50 rounded-xl p-4 flex flex-col border border-capone-700/50">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-capone-700">
                  <h3 className="font-bold text-gray-300 capitalize">{status === 'pending' ? 'Pendentes' : status === 'preparing' ? 'Em Preparo' : status === 'delivery' ? 'Em Rota' : 'Concluídos'}</h3>
                  <span className="bg-capone-800 text-xs px-2 py-1 rounded-full text-gray-400">
                    {orders.filter(o => o.status === status && !o.archived).length}
                  </span>
                </div>
                <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                  {orders.filter(o => o.status === status && !o.archived).map(order => (
                    <Card key={order.id} className="p-3 cursor-pointer hover:border-capone-gold transition-colors group">
                      <div className="flex justify-between mb-2">
                        <span className="font-bold text-white text-sm">#{order.id.split('-')[1]}</span>
                        <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      <p className="text-sm text-gray-300 font-medium truncate">{order.userName}</p>
                      <div className="my-2 border-t border-capone-700/50 pt-2 space-y-1">
                        {order.items.map((item, idx) => (
                          <p key={idx} className="text-xs text-gray-400 flex justify-between">
                            <span>{item.quantity}x {item.name}</span>
                          </p>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-capone-700/50">
                        <span className="font-bold text-capone-gold text-sm">R$ {order.total.toFixed(2)}</span>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           {status !== 'pending' && (
                             <button 
                               className="p-1 hover:bg-capone-700 rounded text-red-400"
                               onClick={() => handleMoveOrder(order.id, 'prev')}
                               title="Voltar Status"
                             >
                               <ChevronLeft size={16} />
                             </button>
                           )}
                           
                           {status !== 'completed' && (
                             <button 
                               className="p-1 hover:bg-capone-700 rounded text-green-400"
                               onClick={() => handleMoveOrder(order.id, 'next')}
                               title="Avançar Status"
                             >
                               <ChevronRight size={16} />
                             </button>
                           )}
                        </div>
                      </div>
                    </Card>
                  ))}
                  {orders.filter(o => o.status === status && !o.archived).length === 0 && (
                    <div className="text-center py-10 text-gray-600 text-sm italic">
                      Nenhum pedido
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col space-y-4 animate-in fade-in">
           {/* Filters */}
           <div className="flex flex-col md:flex-row gap-4 justify-between items-end bg-capone-800 p-4 rounded-xl border border-capone-700">
              <div className="flex gap-2">
                 <button onClick={() => setHistoryFilter('today')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${historyFilter === 'today' ? 'bg-capone-gold text-capone-900' : 'bg-capone-900 text-gray-400 border border-capone-700'}`}>Hoje</button>
                 <button onClick={() => setHistoryFilter('week')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${historyFilter === 'week' ? 'bg-capone-gold text-capone-900' : 'bg-capone-900 text-gray-400 border border-capone-700'}`}>7 Dias</button>
                 <button onClick={() => setHistoryFilter('month')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${historyFilter === 'month' ? 'bg-capone-gold text-capone-900' : 'bg-capone-900 text-gray-400 border border-capone-700'}`}>Mês</button>
                 <button onClick={() => setHistoryFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${historyFilter === 'all' ? 'bg-capone-gold text-capone-900' : 'bg-capone-900 text-gray-400 border border-capone-700'}`}>Tudo</button>
              </div>
              <div className="text-right">
                 <p className="text-gray-400 text-xs uppercase">Total no Período</p>
                 <p className="text-2xl font-bold text-capone-gold font-serif">R$ {historyTotal.toFixed(2)}</p>
              </div>
           </div>

           {/* Table */}
           <div className="bg-capone-900 rounded-xl border border-capone-700 flex-1 overflow-hidden flex flex-col">
              <div className="overflow-y-auto flex-1">
                 <table className="w-full text-left">
                    <thead className="bg-capone-800 text-gray-400 text-xs uppercase sticky top-0">
                       <tr>
                          <th className="p-4">Data</th>
                          <th className="p-4">Pedido</th>
                          <th className="p-4">Cliente</th>
                          <th className="p-4">Itens</th>
                          <th className="p-4 text-right">Valor</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-capone-700">
                       {historyOrders.map(order => (
                          <tr key={order.id} className="hover:bg-capone-800/50">
                             <td className="p-4 text-gray-400 text-sm">
                                {new Date(order.createdAt).toLocaleDateString()} <span className="text-xs text-gray-600">{new Date(order.createdAt).toLocaleTimeString()}</span>
                             </td>
                             <td className="p-4 text-white font-mono text-sm">#{order.id}</td>
                             <td className="p-4 text-white text-sm">{order.userName}</td>
                             <td className="p-4 text-gray-400 text-sm max-w-xs truncate" title={order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                                {order.items.length} itens
                             </td>
                             <td className="p-4 text-right font-bold text-capone-gold">R$ {order.total.toFixed(2)}</td>
                          </tr>
                       ))}
                       {historyOrders.length === 0 && (
                          <tr>
                             <td colSpan={5} className="p-8 text-center text-gray-500 italic">Nenhum histórico encontrado para este período.</td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
    );
  };

  const renderAdminProducts = () => {
    // ... (Maintained as in previous version, just ensuring it's available)
    return (
      <div className="space-y-6 relative">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-serif text-white">Catálogo</h2>
          <Button onClick={() => openProductModal()}><Plus size={18} /> Novo Produto</Button>
        </div>

        {/* Mobile list */}
        <div className="md:hidden space-y-3">
          {products.map(product => (
            <Card key={product.id} className="p-4 flex items-start gap-3">
              <img src={normalizeMediaUrl(product.image) || 'https://via.placeholder.com/48'} className="w-12 h-12 rounded object-cover" crossOrigin="anonymous" />
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-semibold leading-tight">{product.name}</h3>
                    <p className="text-gray-400 text-xs">{product.category}</p>
                  </div>
                  <span className="text-capone-gold font-serif font-bold">R$ {product.price.toFixed(2)}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => openProductModal(product)} className="px-3 py-2 text-xs bg-capone-800 hover:bg-capone-700 rounded text-gray-200 flex items-center gap-1">
                    <Edit2 size={14} /> Editar
                  </button>
                  <button onClick={() => handleDeleteProduct(product.id)} className="px-3 py-2 text-xs bg-red-900/30 hover:bg-red-900/50 rounded text-red-300 flex items-center gap-1">
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop/tablet table */}
        <div className="hidden md:block bg-capone-900 rounded-xl border border-capone-700 overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-capone-800 text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Produto</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Preço</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-capone-700">
              {products.map(product => (
                <tr key={product.id} className="hover:bg-capone-800/50 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <img src={normalizeMediaUrl(product.image) || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded object-cover" crossOrigin="anonymous" />
                    <span className="font-medium text-white">{product.name}</span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{product.category}</td>
                  <td className="p-4 text-white font-mono">R$ {product.price.toFixed(2)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${product.available ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                      {product.available ? 'Disponível' : 'Esgotado'}
                    </span>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <button 
                      onClick={() => openProductModal(product)} 
                      type="button"
                      className="text-gray-400 hover:text-white mx-1 p-2 rounded hover:bg-capone-700 transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteProduct(product.id);
                      }}
                      type="button"
                      title="Excluir Produto"
                      className="text-gray-400 hover:text-red-400 mx-1 p-2 rounded hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 size={16} className="pointer-events-none" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <Card className="w-full max-w-lg p-6 bg-capone-900 border-capone-gold/50 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-serif text-white">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
              </div>
              
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">Nome do Produto</label>
                  <input 
                    type="text" 
                    value={productFormData.name}
                    onChange={e => setProductFormData({...productFormData, name: e.target.value})}
                    className="w-full bg-capone-800 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none"
                    placeholder="Ex: Super Burger"
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1 uppercase">Preço (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={productFormData.price}
                      onChange={e => setProductFormData({...productFormData, price: parseFloat(e.target.value)})}
                      className="w-full bg-capone-800 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-400 mb-1 uppercase">Categoria</label>
                    <select 
                      value={productFormData.category}
                      onChange={e => setProductFormData({...productFormData, category: e.target.value})}
                      className="w-full bg-capone-800 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none"
                    >
                      <option value="Burgers">Burgers</option>
                      <option value="Sides">Sides</option>
                      <option value="Drinks">Drinks</option>
                      <option value="Desserts">Sobremesas</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">URL da Imagem</label>
                  <input 
                    type="text" 
                    value={productFormData.image}
                    onChange={e => setProductFormData({...productFormData, image: e.target.value})}
                    className="w-full bg-capone-800 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1 uppercase">Descrição</label>
                  <textarea 
                    rows={3}
                    value={productFormData.description}
                    onChange={e => setProductFormData({...productFormData, description: e.target.value})}
                    className="w-full bg-capone-800 border border-capone-700 rounded-lg p-3 text-white focus:border-capone-gold outline-none resize-none"
                    placeholder="Descrição detalhada dos ingredientes..."
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="available" 
                    checked={productFormData.available}
                    onChange={e => setProductFormData({...productFormData, available: e.target.checked})}
                    className="w-5 h-5 rounded border-capone-700 bg-capone-800 text-capone-gold focus:ring-capone-gold"
                  />
                  <label htmlFor="available" className="text-gray-300 cursor-pointer">Produto Disponível</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsProductModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="flex-1"><Save size={18}/> Salvar</Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    );
  };

  // ... (OrderTracker, OrdersView, ClientHome, CartView components maintained as they were) ...
  const OrderTracker = ({ order }: { order: Order }) => {
    // ... (logic from previous step)
    const steps = [
      { id: 'pending', label: 'Recebido', icon: Clock },
      { id: 'preparing', label: 'Preparo', icon: ChefHat },
      { id: 'delivery', label: 'Entrega', icon: Truck },
      { id: 'completed', label: 'Entregue', icon: CheckCircle },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === order.status);
    
    // Map simulation helper
    const getMapPosition = () => {
      switch(order.status) {
        case 'pending': return 'top-[80%] left-[80%]'; // Store
        case 'preparing': return 'top-[80%] left-[80%]'; // Store
        case 'delivery': return 'top-[40%] left-[50%]'; // En route
        case 'completed': return 'top-[20%] left-[20%]'; // Home
        default: return 'top-[80%] left-[80%]';
      }
    };

    return (
      <Card className="mb-8 overflow-hidden bg-capone-900 border-capone-700">
         {/* Map Simulation */}
         <div className="h-48 bg-gray-800 relative overflow-hidden group">
            {/* Map Background (Styled) */}
            <div className="absolute inset-0 opacity-40 bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Map_of_Belo_Horizonte_%28OpenStreetMap%29.png/640px-Map_of_Belo_Horizonte_%28OpenStreetMap%29.png')] bg-cover bg-center grayscale contrast-125"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-capone-900 to-transparent"></div>
            
            {/* Store Marker */}
            <div className="absolute top-[80%] left-[80%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
               <div className="w-8 h-8 bg-capone-900 rounded-full flex items-center justify-center border-2 border-capone-gold z-10">
                    <img src={normalizeMediaUrl(appLogo)} className="w-6 h-6 rounded-full" crossOrigin="anonymous" />
               </div>
               <span className="text-[10px] font-bold bg-black/80 px-1 rounded text-white mt-1">Loja</span>
            </div>

             {/* Home Marker */}
             <div className="absolute top-[20%] left-[20%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
               <MapPin className="text-red-500 fill-red-500/20 drop-shadow-lg" size={32} />
               <span className="text-[10px] font-bold bg-black/80 px-1 rounded text-white mt-1">Você</span>
            </div>

            {/* Delivery Bike (Dynamic) */}
            {order.status !== 'completed' && order.status !== 'cancelled' && (
              <div className={`absolute ${getMapPosition()} -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 ease-in-out z-20`}>
                 <div className="w-10 h-10 bg-capone-gold rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.6)] animate-bounce">
                    {order.status === 'delivery' ? <Truck className="text-capone-900" size={20}/> : <Clock className="text-capone-900" size={20}/>}
                 </div>
              </div>
            )}
         </div>

         <div className="p-6">
            <div className="flex justify-between items-start mb-8">
               <div>
                  <h3 className="text-2xl font-serif text-white mb-1">Acompanhar Pedido</h3>
                  <p className="text-gray-400 text-sm">Previsão de entrega: 15-20 min</p>
               </div>
               <div className="text-right">
                  <span className="font-mono text-capone-gold text-xl font-bold block">#{order.id.split('-')[1]}</span>
                  <span className="text-xs text-gray-500 uppercase">ID do Pedido</span>
               </div>
            </div>

            {/* Stepper */}
            <div className="relative flex justify-between">
               {/* Progress Line */}
               <div className="absolute top-1/2 left-0 w-full h-1 bg-capone-800 -translate-y-1/2 z-0"></div>
               <div 
                  className="absolute top-1/2 left-0 h-1 bg-capone-gold -translate-y-1/2 z-0 transition-all duration-500"
                  style={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
               ></div>

               {steps.map((step, index) => {
                  const isActive = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                     <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'bg-capone-gold border-capone-gold text-capone-900' : 'bg-capone-900 border-capone-700 text-gray-500'}`}>
                           <step.icon size={18} />
                        </div>
                        <span className={`text-xs font-medium ${isCurrent ? 'text-white' : isActive ? 'text-gray-300' : 'text-gray-600'}`}>{step.label}</span>
                     </div>
                  );
               })}
            </div>

            {/* Order Summary Dropdown-ish */}
            <div className="mt-8 pt-6 border-t border-capone-800">
               <div className="flex justify-between items-center text-sm mb-2">
                 <span className="text-gray-400">Itens do Pedido ({order.items.length})</span>
                 <span className="text-white font-bold">R$ {order.total.toFixed(2)}</span>
               </div>
               <div className="space-y-1">
                  {order.items.map((item, idx) => (
                    <p key={idx} className="text-xs text-gray-500 flex justify-between">
                      <span>{item.quantity}x {item.name}</span>
                    </p>
                  ))}
               </div>
            </div>
         </div>
      </Card>
    );
  };

  const OrdersView = () => {
    if (!user) return <div className="p-8 text-center text-white">Faça login para ver seus pedidos.</div>;
    
    const myOrders = orders.filter(o => o.userId === user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const activeOrders = myOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    const pastOrders = myOrders.filter(o => o.status === 'completed' || o.status === 'cancelled');

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
        <h2 className="text-3xl font-serif text-white mb-8 flex items-center gap-3">
          <ShoppingBag className="text-capone-gold"/> Meus Pedidos
        </h2>

        {myOrders.length === 0 ? (
          <div className="text-center py-20 bg-capone-800/30 rounded-xl border border-dashed border-capone-700">
             <ShoppingBag size={64} className="mx-auto text-capone-700 mb-6" />
             <h3 className="text-xl font-bold text-white mb-2">Você ainda não fez pedidos</h3>
             <Button onClick={() => setView('home')}>Ver Cardápio</Button>
          </div>
        ) : (
          <div className="space-y-8">
            {activeOrders.length > 0 && (
              <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="text-capone-gold"/> Em Andamento
                </h3>
                {activeOrders.map(order => (
                  <OrderTracker key={order.id} order={order} />
                ))}
              </section>
            )}

            {pastOrders.length > 0 && (
              <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <History className="text-gray-400"/> Histórico
                </h3>
                <div className="space-y-4">
                  {pastOrders.map(order => (
                    <Card key={order.id} className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-capone-900 border-capone-800">
                       <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${order.status === 'completed' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                             {order.status === 'completed' ? <CheckCircle size={24}/> : <X size={24}/>}
                          </div>
                          <div>
                             <div className="flex items-center gap-2">
                               <p className="font-bold text-white">Pedido #{order.id.split('-')[1]}</p>
                               <Badge status={order.status} />
                             </div>
                             <p className="text-sm text-gray-400">{new Date(order.createdAt).toLocaleDateString()} às {new Date(order.createdAt).toLocaleTimeString()}</p>
                             <p className="text-sm text-gray-500">{order.items.length} itens • R$ {order.total.toFixed(2)}</p>
                          </div>
                       </div>
                       <Button variant="outline" className="text-xs" onClick={() => {
                          alert('Itens:\n' + order.items.map(i => `${i.quantity}x ${i.name}`).join('\n'));
                       }}>
                          Ver Itens
                       </Button>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    );
  };

  const ClientHome = () => {
    // ... (maintained)
    const [activeCategory, setActiveCategory] = useState('All');
    const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (heroImages.length === 0) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % heroImages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [heroImages.length]);

    const filteredProducts = activeCategory === 'All' 
        ? products 
        : products.filter(p => p.category === activeCategory);

    return (
        <div className="pb-20 animate-in fade-in duration-500">
            {/* Hero Section */}
            {heroImages.length > 0 && (
              <div className="relative h-[40vh] min-h-[280px] sm:min-h-[360px] md:min-h-[400px] overflow-hidden bg-black">
                  {heroImages.map((media, index) => (
                      <div 
                          key={index}
                          className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                      >
                          {isVideo(media) ? (
                            <video 
                                src={media} 
                                className="w-full h-full object-cover" 
                                autoPlay 
                                muted 
                                loop 
                                playsInline 
                            />
                          ) : (
                            <img src={media} alt="Hero" className="w-full h-full object-cover" />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-capone-900 via-transparent to-transparent"></div>
                      </div>
                  ))}
                  
                  <div className="absolute bottom-0 left-0 p-8 z-10 max-w-2xl animate-in slide-in-from-bottom-10 fade-in duration-700">
                      <h1 className="text-4xl sm:text-5xl md:text-7xl font-serif font-bold text-white mb-4 drop-shadow-lg">
                          <span className="text-capone-gold">Al</span> Capone
                      </h1>
                      <p className="text-base sm:text-lg md:text-xl text-gray-200 mb-6 drop-shadow-md font-medium">
                          O verdadeiro sabor da máfia. Burgers artesanais, ingredientes proibidos e uma experiência criminosa.
                      </p>
                      <Button onClick={() => document.getElementById('menu')?.scrollIntoView({behavior: 'smooth'})}>
                          Ver Cardápio
                      </Button>
                  </div>

                  {/* Indicators */}
                  <div className="absolute bottom-4 right-4 flex gap-2 z-10">
                      {heroImages.map((_, idx) => (
                          <button 
                              key={idx}
                              onClick={() => setCurrentSlide(idx)}
                              className={`w-3 h-3 rounded-full transition-colors ${idx === currentSlide ? 'bg-capone-gold' : 'bg-white/50 hover:bg-white'}`}
                          />
                      ))}
                  </div>
              </div>
            )}

            {/* Menu Section */}
            <div id="menu" className="max-w-7xl mx-auto px-4 py-12">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                    <div>
                        <h2 className="text-3xl font-serif text-white mb-2">Nosso Cardápio</h2>
                        <div className="h-1 w-20 bg-capone-gold"></div>
                    </div>

                    {/* Category Filter */}
                    <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${
                                    activeCategory === cat 
                                    ? 'bg-capone-gold text-capone-900' 
                                    : 'bg-capone-800 text-gray-400 hover:bg-capone-700'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map(product => (
                            <ProductCard 
                                key={product.id} 
                                product={{...product, image: normalizeMediaUrl(product.image)}} 
                                onAdd={addToCart} 
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-capone-800/30 rounded-xl border border-dashed border-capone-700">
                        <ChefHat size={48} className="mx-auto text-capone-700 mb-4" />
                        <p className="text-gray-500 text-lg">Nenhum produto encontrado nesta categoria.</p>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const CartView = () => {
    // ... (maintained)
    return (
    <div className="max-w-4xl mx-auto px-4 py-8 min-h-[60vh] animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('home')} className="p-2 hover:bg-capone-800 rounded-full transition-colors text-white">
            <ChevronLeft size={24} />
        </button>
        <h2 className="text-3xl font-serif text-white">Seu Carrinho</h2>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-20 bg-capone-800/30 rounded-xl border border-dashed border-capone-700">
           <ShoppingBag size={64} className="mx-auto text-capone-700 mb-6" />
           <h3 className="text-xl font-bold text-white mb-2">Seu carrinho está vazio</h3>
           <p className="text-gray-500 mb-8">Parece que você ainda não escolheu seu pedido.</p>
           <Button onClick={() => setView('home')}>
             Ver Cardápio
           </Button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
           {/* Items List */}
           <div className="flex-1 space-y-4">
              {cart.map(item => (
                 <Card key={item.cartId} className="p-4 flex gap-4 hover:border-capone-gold/30 transition-colors">
                    <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-lg" />
                    <div className="flex-1 flex flex-col justify-between">
                       <div className="flex justify-between items-start">
                          <div>
                             <h4 className="font-bold text-white text-lg">{item.name}</h4>
                             <p className="text-gray-400 text-sm">{item.category}</p>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.cartId)}
                            className="text-gray-500 hover:text-red-400 p-1"
                          >
                             <Trash2 size={18} />
                          </button>
                       </div>
                       
                       <div className="flex justify-between items-end mt-2">
                          <div className="flex items-center gap-3 bg-capone-900 rounded-lg px-2 py-1 border border-capone-700">
                             <span className="text-xs text-gray-500 uppercase">Qtd</span>
                             <span className="font-bold text-white">{item.quantity}</span>
                          </div>
                          <div className="text-right">
                             <span className="text-xs text-gray-500 block">Total Item</span>
                             <span className="font-bold text-capone-gold text-lg">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                       </div>
                    </div>
                 </Card>
              ))}
           </div>

           {/* Summary */}
           <div className="w-full lg:w-80">
              <Card className="p-6 sticky top-24">
                 <h3 className="font-bold text-white mb-4 pb-4 border-b border-capone-700">Resumo do Pedido</h3>
                 
                 <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-gray-400">
                       <span>Subtotal</span>
                       <span>R$ {cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                       <span>Taxa de Entrega</span>
                       <span>R$ 5.00</span>
                    </div>
                 </div>

                 <div className="flex justify-between items-center pt-4 border-t border-capone-700 mb-6">
                    <span className="font-bold text-white">Total</span>
                    <span className="font-bold text-2xl text-capone-gold">R$ {(cartTotal + 5).toFixed(2)}</span>
                 </div>

                 <Button className="w-full py-4 text-lg" onClick={placeOrder}>
                    Finalizar Pedido
                 </Button>

                 <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
                    <CheckCircle size={12} /> Pagamento na entrega
                 </p>
              </Card>
           </div>
        </div>
      )}
    </div>
    );
  };

  // ProfileView removed from here and extracted to top level

  // --- Main Render ---

  if (view === 'auth') {
    return (
      <AuthView 
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPass={loginPass}
        setLoginPass={setLoginPass}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        loginError={loginError}
        handleLogin={handleLogin}
        appLogo={appLogo}
        onGoogleLogin={(u) => loginSuccess(u, 'home')}
      />
    );
  }

  // Admin Layout
  if (user?.role === 'admin') {
    return (
      <div className="min-h-screen bg-capone-900 text-gray-100 font-sans">
        <Navbar />
        <AdminSidebar />
        <main className="md:ml-64 pt-20 p-6 min-h-screen transition-all">
          {view === 'admin-dash' && <AdminDashboard />}
          {view === 'admin-products' && renderAdminProducts()}
          {view === 'admin-banners' && (
            <AdminBanners 
              heroImages={heroImages}
              handleAddHeroImage={handleAddHeroImage}
              handleRemoveHeroImage={handleRemoveHeroImage}
              handleHeroImageUpload={handleHeroImageUpload}
              handleResetHeroImages={handleResetHeroImages}
            />
          )}
          {view === 'admin-orders' && <AdminOrders />}
          {view === 'admin-integrations' && <AdminIntegrations />}
          {view === 'admin-settings' && <AdminSettings />}
        </main>
      </div>
    );
  }

  // Client Layout
  return (
    <div className="min-h-screen bg-capone-900 text-gray-100 font-sans relative">
      <Navbar />
      {user && user.role === 'client' && <ClientSidebar />}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/40 md:hidden z-30" onClick={() => setIsMenuOpen(false)} />
      )}
      <main className="pt-20 min-h-screen">
        {view === 'home' && <ClientHome />}
        {view === 'cart' && <CartView />}
        {view === 'orders' && <OrdersView />}
        {view === 'profile' && user && (
          <ProfileView 
            user={user}
            onSaveProfile={saveUserProfile}
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-black text-gray-500 py-12 px-6 border-t border-capone-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src={normalizeMediaUrl(appLogo)} alt="Logo" className="w-16 h-16 rounded-full object-cover" crossOrigin="anonymous" />
              <span className="font-serif font-bold text-2xl text-capone-gold">AL CAPONE</span>
            </div>
            <p className="text-sm">A melhor hamburgueria temática de Belo Horizonte. Sabor criminosamente bom.</p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Links Úteis</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => setView('home')}>Cardápio</button></li>
              <li><button onClick={() => setView('orders')}>Meus Pedidos</button></li>
              <li>Termos de Uso</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Contato</h4>
            <ul className="space-y-2 text-sm">
              <li>Rua da Bahia, 123 - Centro</li>
              <li>Belo Horizonte - MG</li>
              <li>+55 (31) 98228-5267</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Horário</h4>
            <ul className="space-y-2 text-sm">
              <li>Seg - Sex: 18h às 23h</li>
              <li>Sáb - Dom: 18h às 01h</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-900 text-center text-xs">
          © 2024 Al Capone Burger. Todos os direitos reservados.
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <WhatsAppButton />
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
