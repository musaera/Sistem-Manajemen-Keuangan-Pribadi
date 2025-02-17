// Import model Finance
const Finance = require('../models/financeModel');

// CRUD 

// Controller untuk mendapatkan semua data finance user
const getFinances = async (req, res) => {
  try {
    // Cari semua data finance milik user yang sedang login
    const finances = await Finance.find({ user: req.user.id });
    res.status(200).json(finances);
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

// Controller untuk membuat data finance baru
const createFinance = async (req, res) => {
  const { title, amount, type, category } = req.body;

  // Validasi input
  if (!title || !amount || !type || !category) {
    return res.status(400).json({ message: 'Semua field harus diisi' });
  }

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ message: 'Tipe harus income atau expense' });
  }

  if (!['salary', 'education', 'health', 'food', 'transportation', 'entertainment', 'utilities', 'others'].includes(category)) {
    return res.status(400).json({ message: 'Kategori harus salary, food, transportation, entertainment, utilities, others' });
  }

  try {
    // Buat data finance baru
    const finance = await Finance.create({
      user: req.user.id,
      title,
      amount,
      type,
      category,
    });

    res.status(201).json(finance);
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat data finance' });
  }
};

// Controller untuk mengupdate data finance
const updateFinance = async (req, res) => {
  const { id } = req.params;

  try {
    // Cari data finance berdasarkan ID
    const finance = await Finance.findById(id);

    // Periksa apakah data ditemukan dan milik user yang sedang login
    if (!finance || finance.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    // Update data finance
    const updatedFinance = await Finance.findByIdAndUpdate(
      id,
      req.body,
      { new: true } // Mengembalikan data yang sudah diperbarui
    );

    res.status(200).json(updatedFinance);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengupdate data finance' });
  }
};

// Controller untuk menghapus data finance
const deleteFinance = async (req, res) => {
  const { id } = req.params;

  try {
    // Cari data finance berdasarkan ID
    const finance = await Finance.findById(id);

    // Periksa apakah data ditemukan dan milik user yang sedang login
    if (!finance || finance.user.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Data tidak ditemukan' });
    }

    // Hapus data finance
    await finance.deleteOne();
    res.status(200).json({ message: 'Data berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus data finance' });
  }
};

// CRUD End


// Fungsi pencarian dan filter
const filterFinance = async (req, res) => {
  try {
    const userId = req.user._id; // Ambil ID user dari JWT    
    const {
      type,        // income atau expense
      month,       // bulan (1-12)
      year,        // tahun (contoh: 2025)
      keyword,     // pencarian kata kunci di title atau category
      category,    // filter kategori
      minAmount,   // jumlah minimum
      maxAmount,    // jumlah maksimum
      startDate,    // dimulai
      endDate       // sampai dengan
    } = req.query; // Ambil query parameters

    // Query dasar: hanya data milik user saat ini
    let query = { user: userId };

    // Filter berdasarkan jenis transaksi (income atau expense)
    if (type) {
      query.type = type; // Contoh: 'income' atau 'expense'
    }

    // Filter berdasarkan tahun
    if (year) {
      const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
      query.createdAt = { $gte: startOfYear, $lt: endOfYear };
    }

    // Filter berdasarkan bulan (jika bulan juga diberikan)
    if (month) {
      if (!query.createdAt) {
        query.createdAt = {};
      }
      const yearValue = year || new Date().getFullYear(); // Gunakan tahun saat ini jika tidak diberikan
      const monthStart = new Date(`${yearValue}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
      const nextMonth = Number(month) + 1;
      const monthEnd = nextMonth > 12
        ? new Date(`${Number(yearValue) + 1}-01-01T00:00:00.000Z`)
        : new Date(`${yearValue}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`);
      query.createdAt.$gte = monthStart;
      query.createdAt.$lt = monthEnd;
    }

    // Filter berdasarkan jumlah uang (minAmount dan maxAmount)
    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = Number(minAmount);
      if (maxAmount) query.amount.$lte = Number(maxAmount);
    }

    // Pencarian berdasarkan kata kunci di title atau category
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex untuk title
        { category: { $regex: keyword, $options: 'i' } }, // Case-insensitive regex untuk kategori
      ];
    }

    // Filter berdasarkan kategori
    if (category) {
      query.category = category;
    }

    // Filter berdasarkan rentang tanggal
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Ambil data berdasarkan query yang telah dibuat / eksekusi query
    const finances = await Finance.find(query).sort({ createdAt: -1 });

    res.status(200).json(finances); // Kirim data yang telah difilter
  } catch (error) {
    res.status(500).json({ message: error.message }); // Tangani error
  }
};

// Fungsi untuk mendapatkan laporan keuangan
const getFinanceSummary = async (req, res) => {
  try {
    // Ambil user ID dari JWT
    const userId = req.user._id;

    // Ambil semua data keuangan user
    const finances = await Finance.find({ user: userId });

    // Hitung total pemasukan, pengeluaran, dan saldo
    const totalIncome = finances
      .filter((item) => item.type === 'income')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpense = finances
      .filter((item) => item.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const balance = totalIncome - totalExpense;

    res.status(200).json({
      totalIncome,
      totalExpense,
      balance,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Fungsi untuk mendapatkan statistik berdasarkan kategori
const getCategoryStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Ambil semua data keuangan user
    const finances = await Finance.find({ user: userId });

    // Kelompokkan data berdasarkan kategori
    const categoryStats = finances.reduce((acc, curr) => {
      if (!acc[curr.category]) {
        acc[curr.category] = { total: 0, count: 0 };
      }
      acc[curr.category].total += curr.amount;
      acc[curr.category].count += 1;
      return acc;
    }, {});

    res.status(200).json(categoryStats);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendapatkan statistik kategori' });
  }
};

// Fungsi untuk mendapatkan statistik bulanan
const getMonthlyStats = async (req, res) => {
  try {
    const userId = req.user.id; // ID user dari JWT
    const { year } = req.query; // Ambil tahun dari query parameter

    if (!year) {
      return res.status(400).json({ message: 'Tahun harus disertakan dalam query parameter.' });
    }

    // Filter data berdasarkan tahun
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);

    const finances = await Finance.find({
      user: userId,
      createdAt: { $gte: startOfYear, $lt: endOfYear },
    });

    // Hitung statistik bulanan
    const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
    }));

    finances.forEach((item) => {
      const monthIndex = item.createdAt.getUTCMonth(); // Dapatkan bulan (0-11)
      if (item.type === 'income') {
        monthlyStats[monthIndex].totalIncome += item.amount;
      } else if (item.type === 'expense') {
        monthlyStats[monthIndex].totalExpense += item.amount;
      }
      monthlyStats[monthIndex].balance =
        monthlyStats[monthIndex].totalIncome - monthlyStats[monthIndex].totalExpense;
    });

    res.status(200).json(monthlyStats); // Kirim data statistik bulanan
  } catch (error) {
    res.status(500).json({ message: error.message }); // Tangani error
  }
};

// Controller untuk mendapatkan laporan keuangan berdasarkan periode tertentu
const getFinanceReportByPeriod = async (req, res) => {
  try {
    const userId = req.user._id; // Ambil ID user dari JWT
    const { startDate, endDate } = req.query; // Ambil tanggal mulai dan akhir dari query

    // Validasi input
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Tanggal mulai dan akhir harus diisi' });
    }

    const start = new Date(startDate); // Konversi tanggal mulai ke format Date
    const end = new Date(endDate); // Konversi tanggal akhir ke format Date

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Format tanggal tidak valid' });
    }

    if (start > end) {
      return res.status(400).json({ message: 'Tanggal mulai harus sebelum tanggal akhir' });
    }

    // Query untuk mengambil data keuangan dalam periode
    const finances = await Finance.find({
      user: userId,
      createdAt: { $gte: start, $lte: end },
    });

    // Hitung total pemasukan, pengeluaran, dan saldo
    const totalIncome = finances
      .filter((item) => item.type === 'income')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const totalExpense = finances
      .filter((item) => item.type === 'expense')
      .reduce((acc, curr) => acc + curr.amount, 0);

    const balance = totalIncome - totalExpense;

    res.status(200).json({
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      balance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan server' });
  }
};

module.exports = {
  getFinances,
  createFinance,
  updateFinance,
  deleteFinance,
  filterFinance,
  getFinanceSummary,
  getCategoryStats,
  getMonthlyStats,
  getFinanceReportByPeriod
};
