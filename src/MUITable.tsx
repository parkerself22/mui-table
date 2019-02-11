import React, { useContext } from "react";
import MUITableUtils from "./MUITableUtils";
import MUITableWrapper from "./MUITableWrapper";
import { MUI_TABLE_CONTEXT } from "../test/utils";
import {
    Context,
    ContextActions,
    ParentProps,
    Props,
    Row,
    StateColumn,
    State
} from "./types";

export function useMUITableContext(): Context {
    const context = useContext<Context>(MUI_TABLE_CONTEXT);
    if (!context) {
        throw new Error(
            `MUITable child components cannot be rendered outside the MUITable component`
        );
    }
    return context;
}

class MUIChildTable extends React.Component<Props<any>, State<any>> {
    constructor(props: Props<any>) {
        super(props);
        const options = props.options;
        const paginateOptions = options.pagination;
        if (
            paginateOptions.rowsPerPage &&
            paginateOptions.rowsPerPageOptions &&
            paginateOptions.rowsPerPageOptions.indexOf(paginateOptions.rowsPerPage) < 0
        ) {
            paginateOptions.rowsPerPageOptions.push(paginateOptions.rowsPerPage);
        }
        this.state = {
            columnFilters: props.columns.map(c => []),
            selectedRows: [],
            search: {
                open: false,
                text: null
            },
            viewColumns: props.columns.map(c => c.display === "true"),
            sortColumn: {
                index: null,
                asc: false
            },
            pagination: {
                page: paginateOptions.page ? paginateOptions.page : 0,
                rowsPerPage: paginateOptions.rowsPerPage ? paginateOptions.rowsPerPage : 5,
                rowsPerPageOptions: paginateOptions.rowsPerPageOptions
                    ? paginateOptions.rowsPerPageOptions
                    : [5, 10, 15]
            }
        };
    }

    sortedFilteredRows = (join: boolean = true) => {
        const { rows, columns, options } = this.props;
        const sorted = MUITableUtils.sortRows(rows, this.state, columns);
        return {
            rows: sorted,
            displayRows: MUITableUtils.filterRows(sorted, this.state, options, columns)
        };
    };

    getVisibleColumns = () => {
        const { columnFilters } = this.state;
        const { columns } = this.props;
        return columns.reduce(
            (visible, col, i) => {
                if (!columnFilters[i]) {
                    return visible;
                }
                return [...visible, col];
            },
            [] as StateColumn<any>[]
        );
    };

    toggleViewColumn = (i: number) => {
        const { viewColumns } = this.state;
        const newViewCols = [...viewColumns];
        if (newViewCols.hasOwnProperty(i)) {
            newViewCols[i] = !newViewCols[i];
            this.setState({ viewColumns: newViewCols });
        }
    };

    searchTextUpdate = (text: string | null) => {
        this.setState({ search: { ...this.state.search, text } });
    };

    toggleSearchVisible = () => {
        const { text, open } = this.state.search;
        this.setState({ search: { text: open ? null : text, open: !this.state.search.open } });
    };

    onFilterUpdate = (colIndex: number, value: string | string[]) => {
        const { columnFilters } = this.state;
        const newFilters = [...columnFilters];
        if (newFilters[colIndex]) {
            if (Array.isArray(value)) {
                newFilters[colIndex] = value;
            } else if (!value || value.length === 0) {
                newFilters[colIndex] = [];
            } else if (newFilters[colIndex].indexOf(value) >= 0) {
                newFilters[colIndex] = newFilters[colIndex].filter(v => v !== value);
            } else {
                newFilters[colIndex] = [value];
            }
            this.setState({ columnFilters: newFilters });
        }
    };

    onFilterReset = () => {
        const { columns } = this.props;
        const columnFilters = columns.map(c => []);
        this.setState({ columnFilters });
    };

    onRowsDelete = () => {
        const { options, rows } = this.props;
        const { selectedRows } = this.state;
        if (options.hooks && options.hooks.onRowsDelete) {
            try {
                options.hooks.onRowsDelete(
                    rows.filter(r => selectedRows.indexOf(MUITableUtils.rowId(r)) >= 0)
                );
            } catch (e) {
                console.error(e);
            }
        }
    };

    toggleRowSelected = (row: Row<any>) => {
        const { selectedRows } = this.state;
        const index = MUITableUtils.findRowIndexById(row, selectedRows);
        if (index < 0) {
            this.setState({ selectedRows: [...selectedRows, MUITableUtils.rowId(row)] });
        } else {
            this.setState({ selectedRows: selectedRows.filter((r, i) => i !== index) });
        }
    };

    getFilterData = (column: StateColumn<any>) => {
        const { rows, columns } = this.props;
        const colIndex = columns.findIndex(c => c.name === column.name);
        if (colIndex < 0) return [];

        const dynamicVals = rows.reduce(
            (opts, row) => {
                if (row[colIndex]) {
                    const opt = row[colIndex].display
                        ? row[colIndex].display
                        : String(row[colIndex].value);
                    if (opt && opts.indexOf(opt) < 0) {
                        return [...opts, opt];
                    }
                }
                return opts;
            },
            [] as string[]
        );
        if (column.filterOptions && column.filterOptions.options) {
            return [...column.filterOptions.options, ...dynamicVals];
        }
        return dynamicVals;
    };

    changePage = (page: number) => {
        const { pagination } = this.state;
        this.setState({ pagination: { ...pagination, page } });
    };

    toggleSort = (colIndex: number) => {
        // default if it wasn't the sort column (we'll go asc, desc, off)
        let newState: Pick<State<any>, "sortColumn"> = {
            sortColumn: { index: colIndex, asc: true }
        };
        if (this.state.sortColumn.index === colIndex) {
            if (this.state.sortColumn.asc) {
                // if asc, switch to desc
                newState = { sortColumn: { asc: false, index: colIndex } };
            } else {
                // if desc, switch to off (asc back to true)
                newState = { sortColumn: { index: null, asc: true } };
            }
        }
        this.setState(newState);
    };

    changeRowsPerPage = (rows: number) => {
        const { pagination } = this.state;
        this.setState({
            pagination: { ...pagination, rowsPerPage: rows }
        });
    };

    handleAllSelect = () => {
        const { displayRows } = this.sortedFilteredRows();
        const { selectedRows } = this.state;
        if (selectedRows.length > 0) {
            return this.setState({ selectedRows: [] });
        }
        this.setState({ selectedRows: displayRows as any });
    };

    render = () => {
        const { options, columns } = this.props;
        const loading = options.loading;
        const { displayRows, rows } = this.sortedFilteredRows();
        const contextActions: ContextActions = {
            toggleViewColumn: this.toggleViewColumn,
            searchTextUpdate: this.searchTextUpdate,
            toggleSearchVisible: this.toggleSearchVisible,
            onFilterUpdate: this.onFilterUpdate,
            onFilterReset: this.onFilterReset,
            onRowsDelete: this.onRowsDelete,
            toggleRowSelected: this.toggleRowSelected,
            handleAllSelect: this.handleAllSelect,
            toggleSort: this.toggleSort,
            changePage: this.changePage,
            changeRowsPerPage: this.changeRowsPerPage,
            getFilterData: this.getFilterData,
            getVisibleColumns: this.getVisibleColumns
        };

        const context: Context = {
            options,
            rows,
            columns,
            ...this.state,
            ...contextActions,
            displayRows
        };

        return (
            <MUI_TABLE_CONTEXT.Provider value={context}>
                <MUITableWrapper loading={loading} />
            </MUI_TABLE_CONTEXT.Provider>
        );
    };
}

const MUIParentTable = (props: ParentProps<any>) => {
    const options = MUITableUtils.buildOptions(props);
    let columns = MUITableUtils.buildStaticColumns(
        props.data,
        options.columns.static,
        options.columns.generated
    );
    if (options.columns.sortColumns) {
        try {
            columns = options.columns.sortColumns(columns);
        } catch (e) {
            console.error(e);
        }
    }
    const rows = MUITableUtils.buildRows(props.data, columns);

    return <MUIChildTable options={options} data={props.data} columns={columns} rows={rows} />;
};

export const MUITable = MUIParentTable;
export default MUIParentTable;