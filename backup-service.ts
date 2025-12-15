
// backup-service.ts

interface BackupData {
  timestamp: string;
  version: string;
  data: {
    products: any[];
    orders: any[];
    heroImages: string[];
    cart: any[];
    logo: string | null;
    // Adicione outras chaves conforme necessário
  };
}

const STORAGE_KEYS = {
  products: 'capone_products',
  orders: 'capone_orders',
  heroImages: 'capone_hero_images',
  cart: 'capone_cart',
  logo: 'capone_logo'
};

/**
 * Gera um objeto contendo todos os dados críticos do sistema
 */
export const generateBackupData = (): BackupData => {
  const getData = (key: string, defaultVal: any) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultVal;
    } catch (e) {
      console.error(`Erro ao ler chave ${key}`, e);
      return defaultVal;
    }
  };

  // Logo é string pura, não JSON
  const logo = localStorage.getItem(STORAGE_KEYS.logo);

  return {
    timestamp: new Date().toISOString(),
    version: '1.0',
    data: {
      products: getData(STORAGE_KEYS.products, []),
      orders: getData(STORAGE_KEYS.orders, []),
      heroImages: getData(STORAGE_KEYS.heroImages, []),
      cart: getData(STORAGE_KEYS.cart, []),
      logo: logo
    }
  };
};

/**
 * Dispara o download do arquivo JSON
 */
export const downloadBackupFile = () => {
  try {
    const backup = generateBackupData();
    const fileName = `capone_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("Erro ao gerar backup:", error);
    return false;
  }
};

/**
 * Lê o arquivo, valida e restaura no LocalStorage
 */
export const restoreFromBackup = async (file: File): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ success: false, message: "Nenhum arquivo selecionado." });
      return;
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup: BackupData = JSON.parse(content);

        // Validação básica
        if (!backup.data || !Array.isArray(backup.data.products)) {
          resolve({ success: false, message: "Arquivo de backup inválido ou corrompido." });
          return;
        }

        // Restauração
        localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(backup.data.products));
        localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(backup.data.orders));
        localStorage.setItem(STORAGE_KEYS.heroImages, JSON.stringify(backup.data.heroImages));
        localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(backup.data.cart));
        
        if (backup.data.logo) {
          localStorage.setItem(STORAGE_KEYS.logo, backup.data.logo);
        }

        resolve({ success: true, message: "Dados restaurados com sucesso! A página será recarregada." });
      } catch (error) {
        console.error("Erro ao processar backup:", error);
        resolve({ success: false, message: "Erro ao ler o arquivo. Verifique se é um JSON válido." });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, message: "Erro de leitura do arquivo." });
    };

    reader.readAsText(file);
  });
};
